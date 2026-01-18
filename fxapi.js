(function () {
'use strict';

/*
 FULL SHARA FXAPI
 Сервер видео: 146.103.111.209
 kinopoisk_id берётся из Lampa

 + SKAZ балансеры (online3/online4) по title:
   /lite/<balancer>?title=...&account_email=...&uid=guest&lampac_unic_id=...

 Debug: подробные логи запросов в консоль.
*/

if (window.shara_fxapi_debug_plugin) return;
window.shara_fxapi_debug_plugin = true;

try { console.log('[SHARA] script loaded (card button fix)'); } catch(e){}

var Defined = {
    name: 'SHARA',
    video_host: 'http://146.103.111.209/',
    uid: 'p8nqb9ii',
    showy_token: 'ik377033-90eb-4d76-93c9-7605952a096l'
};

var Skaz = {
    hosts: [
        'http://online3.skaz.tv/lite/',
        'http://online4.skaz.tv/lite/'
    ],
    balancers: ['videocdn', 'filmix', 'kinopub', 'alloha', 'rhsprem', 'rezka'],
    account_email: 'aklama%40mail.ru',
    uid: 'guest',
    unic_id_key: 'lampac_unic_id'
};

var Network = Lampa.Reguest;

function component(object) {
    var network = new Network();
    var scroll = new Lampa.Scroll({ mask: true, over: true });
    var files = new Lampa.Explorer(object);

    var last;
    var history = [];

    function log() {
        try { console.log.apply(console, ['[SHARA]'].concat([].slice.call(arguments))); } catch (e) {}
    }

    function err() {
        try { console.error.apply(console, ['[SHARA]'].concat([].slice.call(arguments))); } catch (e) {}
    }

    function getSkazUnicId() {
        var unic = Lampa.Storage.get(Skaz.unic_id_key);
        if (!unic) {
            unic = Math.random().toString(36).slice(2, 10);
            Lampa.Storage.set(Skaz.unic_id_key, unic);
        }
        return unic;
    }

    function isSkazUrl(url) {
        return !!(url && (
            url.indexOf('online3.skaz.tv') !== -1 ||
            url.indexOf('online4.skaz.tv') !== -1
        ));
    }

    function normalizeUrl(url, base_url) {
        if (!url) return url;
        if (/^https?:\/\//i.test(url)) return url;

        var a = document.createElement('a');
        a.href = base_url || '';
        var origin = a.protocol + '//' + a.host;

        if (url.indexOf('//') === 0) return a.protocol + url;
        if (url[0] === '/') return origin + url;

        return origin + '/' + url;
    }

    function applySkazAuth(url) {
        if (!url) return url;
        if (!isSkazUrl(url)) return url;

        url = url
            .replace(/([?&])(uid|account_email|lampac_unic_id)=[^&]*/g, '$1')
            .replace(/\?&/g, '?')
            .replace(/&&/g, '&')
            .replace(/[?&]$/g, '');

        var sep = url.indexOf('?') === -1 ? '?' : '&';
        return url + sep +
            'account_email=' + Skaz.account_email +
            '&uid=' + Skaz.uid +
            '&lampac_unic_id=' + getSkazUnicId();
    }

    function buildUrls() {
        var urls = [];

        // 1) FXAPI по kinopoisk_id (146.103.111.209)
        if (object.movie && object.movie.kinopoisk_id) {
            urls.push(
                Defined.video_host + 'lite/fxapi' +
                '?rjson=False' +
                '&kinopoisk_id=' + object.movie.kinopoisk_id +
                '&s=1' +
                '&uid=' + Defined.uid +
                '&showy_token=' + Defined.showy_token
            );
        }

        // 2) SKAZ балансеры по title
        if (object.movie && object.movie.title) {
            var title = encodeURIComponent(object.movie.title);

            Skaz.hosts.forEach(function (host) {
                Skaz.balancers.forEach(function (b) {
                    urls.push(applySkazAuth(host + b + '?title=' + title));
                });
            });
        }

        return urls;
    }

    function parseHtml(str, base_url) {
        var html = $('<div>' + str + '</div>');
        var items = [];

        html.find('.videos__item').each(function () {
            var el = $(this);
            var json = el.attr('data-json');
            if (!json) return;

            var data;
            try { data = JSON.parse(json); }
            catch (e) {
                err('JSON.parse error', e, 'json preview:', (json || '').slice(0, 200));
                return;
            }

            if (data.url) {
                data.url = normalizeUrl(data.url, base_url);
                data.url = applySkazAuth(data.url);
            }

            if (data.quality && typeof data.quality === 'object') {
                Object.keys(data.quality).forEach(function (q) {
                    if (typeof data.quality[q] === 'string') {
                        var qurl = normalizeUrl(data.quality[q], base_url);
                        data.quality[q] = applySkazAuth(qurl);
                    }
                });
            }

            data.title =
                el.find('.videos__item-title').text() ||
                data.translate ||
                data.title ||
                'Видео';

            data.voice_name = data.translate || data.voice_name || data.title;
            if (!data.method) data.method = 'play';

            if (data.quality) {
                data.qualitys = data.quality;
                data.quality = Object.keys(data.quality)[0];
            }

            items.push(data);
        });

        return items;
    }

    function play(item) {
        log('Play', item.title, item.url);

        Lampa.Player.play({
            title: item.title,
            url: item.url,
            quality: item.qualitys,
            voice_name: item.voice_name,
            isonline: true
        });
    }

    function render(videos) {
        scroll.clear();

        videos.forEach(function (item) {
            var html = Lampa.Template.get('lampac_prestige_full', {
                title: item.title,
                time: '',
                info: item.voice_name || '',
                quality: item.quality || ''
            });

            html.on('hover:enter', function () {
                if (!item.url) return;

                if (item.method === 'link') requestUrl(item.url, true);
                else play(item);
            });

            html.on('hover:focus', function (e) {
                last = e.target;
                scroll.update($(e.target), true);
            });

            scroll.append(html);
        });

        Lampa.Controller.enable('content');
    }

    function requestUrl(url, push_history) {
        if (!url) return;

        url = applySkazAuth(url);
        log('GET', url);

        network.native(
            url,
            function (str) {
                log('OK', url, 'len:', (str || '').length, 'preview:', (str || '').slice(0, 160));
                if (push_history) history.push(url);

                var videos = parseHtml(str, url);
                log('Parsed items:', videos.length, 'from', url);

                if (videos.length) render(videos);
                else empty();
            },
            function (e) {
                err('ERROR', url, e);
                empty();
            },
            false,
            { dataType: 'text' }
        );
    }

    function request() {
        history = [];

        var urls = buildUrls();
        log('Movie:', object && object.movie ? { title: object.movie.title, kinopoisk_id: object.movie.kinopoisk_id } : object);
        log('Queue size:', urls.length);
        try { log('Queue:', urls); } catch (e) {}

        if (!urls.length) return empty();

        var i = 0;

        function next() {
            var url = urls[i++];
            if (!url) return empty();

            log('TRY', url);

            network.native(
                url,
                function (str) {
                    log('OK', url, 'len:', (str || '').length, 'preview:', (str || '').slice(0, 160));

                    var videos = parseHtml(str, url);
                    log('Parsed items:', videos.length, 'from', url);

                    if (videos.length) render(videos);
                    else next();
                },
                function (e) {
                    err('ERROR', url, e);
                    next();
                },
                false,
                { dataType: 'text' }
            );
        }

        next();
    }

    function empty() {
        scroll.clear();
        scroll.append(Lampa.Template.get('lampac_does_not_answer', {}));
    }

    this.start = function () {
        request();

        Lampa.Controller.add('content', {
            toggle: function () {
                Lampa.Controller.collectionSet(scroll.render(), files.render());
                Lampa.Controller.collectionFocus(last || false, scroll.render());
            },
            back: function () {
                if (history.length) {
                    var prev = history.pop();
                    requestUrl(prev, false);
                    return;
                }
                Lampa.Activity.backward();
            }
        });

        Lampa.Controller.toggle('content');
    };

    this.render = function () {
        return files.render();
    };

    this.destroy = function () {
        network.clear();
        scroll.destroy();
        files.destroy();
    };
}

function addToManifest(plugin) {
    // Не перезатираем Lampa.Manifest.plugins (из-за этого кнопка может не появляться). [file:1]
    if (!Lampa.Manifest) Lampa.Manifest = {};

    // В разных сборках бывает по-разному: массив или объект-реестр.
    if (!Lampa.Manifest.plugins) Lampa.Manifest.plugins = [];

    if (Array.isArray(Lampa.Manifest.plugins)) {
        var exists = Lampa.Manifest.plugins.some(function (p) { return p && p.name === plugin.name; });
        if (!exists) Lampa.Manifest.plugins.push(plugin);
    }
    else if (typeof Lampa.Manifest.plugins === 'object') {
        Lampa.Manifest.plugins[plugin.name] = plugin;
    }
}

function startPlugin() {
    try { console.log('[SHARA] register plugin'); } catch(e){}

    Lampa.Component.add('SHARA', component);

    addToManifest({
        // Если в шторке рядом с торрентами показываются именно онлайн-источники,
        // обычно лучше ставить тип "online", а не перезатирать системные списки.
        type: 'online',
        name: 'SHARA',
        description: 'SHARA FXAPI FULL (debug)',
        component: 'SHARA',
        onContextMenu: function () {
            return {
                name: 'Смотреть онлайн',
                description: 'SHARA'
            };
        },
        onContextLauch: function (object) {
            Lampa.Activity.push({
                title: 'SHARA',
                component: 'SHARA',
                movie: object
            });
        }
    });
}

// Запуск после готовности приложения (иначе кнопка может не успеть зарегистрироваться). [web:58]
if (window.appready) startPlugin();
else {
    Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') startPlugin();
    });
}

})();

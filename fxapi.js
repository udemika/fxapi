(function () {
'use strict';

/*
 FULL SHARA FXAPI
 Сервер видео: 146.103.111.209
 kinopoisk_id берётся из Lampa
*/

var Defined = {
    name: 'SHARA',
    video_host: 'http://146.103.111.209/',
    uid: 'p8nqb9ii',
    showy_token: 'ik377033-90eb-4d76-93c9-7605952a096l'
};

var Network = Lampa.Reguest;

function component(object) {
    var network = new Network();
    var scroll = new Lampa.Scroll({ mask: true, over: true });
    var files = new Lampa.Explorer(object);

    var last;

    function buildUrls() {
        if (!object.movie) return [];

        var urls = [];

        // --- 1) FXAPI по kinopoisk_id ---
        if (object.movie.kinopoisk_id) {
            var fxapi_base =
                '?rjson=False' +
                '&kinopoisk_id=' + object.movie.kinopoisk_id +
                '&s=1';

            // как было (146.103.111.209 + showy_token)
            urls.push(
                Defined.video_host + 'lite/fxapi' +
                fxapi_base +
                '&uid=' + Defined.uid +
                '&showy_token=' + Defined.showy_token
            );

            // online3/online7 fxapi (skaz auth)
            var skaz_auth =
                '&account_email=aklama%40mail.ru' +
                '&uid=guest';

            urls.push('http://online3.skaz.tv/lite/fxapi' + fxapi_base + skaz_auth);
            urls.push('http://online7.skaz.tv/lite/fxapi' + fxapi_base + skaz_auth);
        }

        // --- 2) Балансеры по title ---
        if (object.movie.title) {
            var title = encodeURIComponent(object.movie.title);

            var skaz_auth2 =
                '&account_email=aklama%40mail.ru' +
                '&uid=guest';

            var hosts = [
                'http://online3.skaz.tv/lite/',
                'http://online7.skaz.tv/lite/'
            ];

            var balancers = [
                'videocdn',
                'filmix',
                'kinopub',
                'alloha',
                'rhsprem',
                'rezka'
            ];

            hosts.forEach(function (host) {
                balancers.forEach(function (b) {
                    // как в примере:
                    // http://online3.skaz.tv/lite/videocdn?title=.....&account_email=...&uid=guest
                    urls.push(host + b + '?title=' + title + skaz_auth2);
                });
            });
        }

        return urls;
    }

    // Жёстко дописываем авторизацию ко всем ссылкам на online3/online7,
    // чтобы переходы "фильм/сезоны" не требовали синхронизацию.
    function appendAuth(url) {
        if (!url) return url;

        if (url.indexOf('account_email=') !== -1 && url.indexOf('uid=') !== -1) return url;

        if (url.indexOf('online3.skaz.tv') === -1 && url.indexOf('online7.skaz.tv') === -1) return url;

        var sep = url.indexOf('?') === -1 ? '?' : '&';
        return url + sep + 'account_email=aklama%40mail.ru&uid=guest';
    }

    function parseHtml(str) {
        var html = $('<div>' + str + '</div>');
        var items = [];

        html.find('.videos__item').each(function () {
            var el = $(this);
            var json = el.attr('data-json');
            if (!json) return;

            var data = JSON.parse(json);

            // ВАЖНО: дописываем авторизацию прямо в url из data-json
            data.url = appendAuth(data.url);

            // Если вдруг quality содержит ссылки — тоже допишем авторизацию
            if (data.quality && typeof data.quality === 'object') {
                Object.keys(data.quality).forEach(function (q) {
                    if (typeof data.quality[q] === 'string') data.quality[q] = appendAuth(data.quality[q]);
                });
            }

            data.title =
                el.find('.videos__item-title').text() ||
                data.translate ||
                'Видео';

            data.voice_name = data.translate || data.title;
            data.method = 'play';

            if (data.quality) {
                data.qualitys = data.quality;
                data.quality = Object.keys(data.quality)[0];
            }

            items.push(data);
        });

        return items;
    }

    function play(item) {
        Lampa.Player.play({
            title: item.title,
            url: item.url,
            quality: item.qualitys,
            voice_name: item.voice_name,
            isonline: true
        });

        saveWatched(item);
    }

    function saveWatched(item) {
        var key = Lampa.Utils.hash(object.movie.kinopoisk_id);
        var watched = Lampa.Storage.get('shara_watched', {});

        watched[key] = {
            title: object.movie.title,
            voice: item.voice_name,
            time: Date.now()
        };

        Lampa.Storage.set('shara_watched', watched);
    }

    function render(videos) {
        scroll.clear();

        videos.forEach(function (item) {
            var html = Lampa.Template.get('lampac_prestige_full', {
                title: item.title,
                time: '',
                info: item.voice_name,
                quality: item.quality || ''
            });

            html.on('hover:enter', function () {
                play(item);
            });

            html.on('hover:focus', function (e) {
                last = e.target;
                scroll.update($(e.target), true);
            });

            scroll.append(html);
        });

        Lampa.Controller.enable('content');
    }

    function request() {
        var urls = buildUrls();
        if (!urls.length) return;

        var i = 0;

        function next() {
            var url = urls[i++];
            if (!url) return empty();

            network.native(
                url,
                function (str) {
                    var videos = parseHtml(str);
                    if (videos.length) render(videos);
                    else next();
                },
                function () {
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

function startPlugin() {
    Lampa.Component.add('SHARA', component);

    Lampa.Manifest.plugins = {
        type: 'video',
        name: 'SHARA',
        description: 'SHARA FXAPI FULL',
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
    };
}

startPlugin();

})();

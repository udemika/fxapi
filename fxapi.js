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

        // FXAPI по kinopoisk_id
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

        // Балансеры по title
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
                    urls.push(host + b + '?title=' + title + skaz_auth2);
                });
            });
        }

        return urls;
    }


    function isSkazUrl(url) {
        return url && (
            url.indexOf('online3.skaz.tv') !== -1 ||
            url.indexOf('online7.skaz.tv') !== -1
        );
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

        // убрать старые account_email/uid, чтобы всегда было uid=guest
        url = url
            .replace(/([?&])(uid|account_email)=[^&]*/g, '$1')
            .replace(/\?&/g, '?')
            .replace(/&&/g, '&')
            .replace(/[?&]$/g, '');

        var sep = url.indexOf('?') === -1 ? '?' : '&';
        return url + sep + 'account_email=aklama%40mail.ru&uid=guest';
    }

    function parseHtml(str, base_url) {
        var html = $('<div>' + str + '</div>');
        var items = [];

        html.find('.videos__item').each(function () {
            var el = $(this);
            var json = el.attr('data-json');
            if (!json) return;

            var data = JSON.parse(json);

            data.url = applySkazAuth(normalizeUrl(data.url, base_url));

            if (data.quality && typeof data.quality === 'object') {
                Object.keys(data.quality).forEach(function (q) {
                    if (typeof data.quality[q] === 'string') {
                        data.quality[q] = applySkazAuth(normalizeUrl(data.quality[q], base_url));
                    }
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
                    var videos = parseHtml(str, url);
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

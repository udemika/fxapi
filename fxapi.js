(function () {
'use strict';

/*
 FULL SHARA FXAPI
 Сервер видео: online3.skaz.tv
 kinopoisk_id берётся из Lampa
*/

var Defined = {
    name: 'SHARA',
    video_host: 'http://online3.skaz.tv/',
    account_email: 'aklama%40mail.ru',
    uid: 'guest'
};

var Network = Lampa.Reguest;

function component(object) {
    var network = new Network();
    var scroll = new Lampa.Scroll({ mask: true, over: true });
    var files = new Lampa.Explorer(object);

    var last;

    function buildUrl() {
        if (!object.movie || !object.movie.kinopoisk_id) return null;

        return Defined.video_host + 'lite/filmix'
            + '?rjson=False'
            + '&kinopoisk_id=' + object.movie.kinopoisk_id
            + '&s=1'
            + '&uid=' + Defined.uid
            + '&showy_token=' + Defined.showy_token;
    }

    function parseHtml(str) {
        var html = $('<div>' + str + '</div>');
        var items = [];

        html.find('.videos__item').each(function () {
            var el = $(this);
            var json = el.attr('data-json');
            if (!json) return;

            var data = JSON.parse(json);

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
        var url = buildUrl();
        if (!url) return;

        network.native(
            url,
            function (str) {
                var videos = parseHtml(str);
                if (videos.length) render(videos);
                else empty();
            },
            empty,
            false,
            { dataType: 'text' }
        );
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
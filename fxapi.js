(function () {
'use strict';

// --- НАСТРОЙКИ ---
var SETTINGS = {
    component: 'SHARA_FX_FULL', // Уникальный ID компонента
    name: 'SHARA',              // Текст на кнопке
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M448 256c0-106-86-192-192-192S64 150 64 256s86 192 192 192 192-86 192-192z" opacity=".2"/><path d="M216.3 363.5l125.8-90.4c9.1-6.5 9.1-20.6 0-27.1L216.3 155.6c-10-7.2-24.3 0-24.3 12.3v183.3c0 12.3 14.3 19.5 24.3 12.3z"/></svg>'
};

if (window.shara_force_loaded) return;
window.shara_force_loaded = true;

console.log('[SHARA] Force Button Plugin Init');

// --- ЛОГИКА FXAPI + ONLINE3/4 ---
var Defined = {
    video_host: 'http://146.103.111.209/',
    uid: 'p8nqb9ii',
    showy_token: 'ik377033-90eb-4d76-93c9-7605952a096l'
};

var Skaz = {
    hosts: ['http://online3.skaz.tv/lite/', 'http://online4.skaz.tv/lite/'],
    balancers: ['videocdn', 'filmix', 'kinopub', 'alloha', 'rhsprem', 'rezka'],
    account_email: 'aklama%40mail.ru',
    uid: 'guest',
    unic_id_key: 'lampac_unic_id'
};

function component(object) {
    var network = new Lampa.Reguest();
    var scroll = new Lampa.Scroll({ mask: true, over: true });
    var files = new Lampa.Explorer(object);
    var last, history = [];

    // ... (стандартные функции: log, err, getSkazUnicId, normalizeUrl, applySkazAuth) ...
    function log() { try { console.log.apply(console, ['[SHARA]'].concat([].slice.call(arguments))); } catch (e) {} }
    function err() { try { console.error.apply(console, ['[SHARA]'].concat([].slice.call(arguments))); } catch (e) {} }
    function getSkazUnicId() {
        var u = Lampa.Storage.get(Skaz.unic_id_key);
        if(!u) { u = Math.random().toString(36).slice(2,10); Lampa.Storage.set(Skaz.unic_id_key, u); }
        return u;
    }
    function isForbidden(u) { return !!(u && (u.indexOf('/lite/events')!==-1 || u.indexOf('/lite/withsearch')!==-1)); }
    function isSkazUrl(u) { return !!(u && (u.indexOf('online3.skaz.tv')!==-1 || u.indexOf('online4.skaz.tv')!==-1)); }
    function normalizeUrl(u, b) {
        if(!u) return u; if(/^https?:\/\//i.test(u)) return u;
        var a = document.createElement('a'); a.href = b||''; 
        if(u.indexOf('//')===0) return a.protocol + u;
        if(u[0]==='/') return a.protocol+'//'+a.host+u;
        return a.protocol+'//'+a.host+'/'+u;
    }
    function applySkazAuth(u) {
        if(!u || !isSkazUrl(u)) return u;
        u = u.replace(/([?&])(uid|account_email|lampac_unic_id)=[^&]*/g, '$1').replace(/\?&/g,'?').replace(/&&/g,'&').replace(/[?&]$/g,'');
        return u + (u.indexOf('?')===-1?'?':'&') + 'account_email='+Skaz.account_email+'&uid='+Skaz.uid+'&lampac_unic_id='+getSkazUnicId();
    }

    function buildUrls() {
        var urls = [];
        if (object.movie && object.movie.kinopoisk_id) {
            urls.push(Defined.video_host + 'lite/fxapi?rjson=False&kinopoisk_id=' + object.movie.kinopoisk_id + '&s=1&uid=' + Defined.uid + '&showy_token=' + Defined.showy_token);
        }
        if (object.movie && object.movie.title) {
            var t = encodeURIComponent(object.movie.title);
            Skaz.hosts.forEach(function (h) { Skaz.balancers.forEach(function (b) { urls.push(applySkazAuth(h + b + '?title=' + t)); }); });
        }
        return urls;
    }

    function parseHtml(str, base) {
        var html = $('<div>' + str + '</div>'), items = [];
        html.find('.videos__item').each(function () {
            var el = $(this), json = el.attr('data-json');
            if (!json) return;
            var d; try { d = JSON.parse(json); } catch (e) { return; }
            if (d.url) d.url = applySkazAuth(normalizeUrl(d.url, base));
            if (d.quality) { Object.keys(d.quality).forEach(function(k){ if(typeof d.quality[k]=='string') d.quality[k]=applySkazAuth(normalizeUrl(d.quality[k], base)); }); }
            d.title = el.find('.videos__item-title').text() || d.title || 'Video';
            if(!d.method) d.method = 'play';
            if (d.quality) { d.qualitys = d.quality; d.quality = Object.keys(d.quality)[0]; }
            items.push(d);
        });
        return items;
    }

    function render(videos) {
        scroll.clear();
        videos.forEach(function (item) {
            var h = Lampa.Template.get('lampac_prestige_full', { title: item.title, time: '', info: item.voice_name || '', quality: item.quality || '' });
            h.on('hover:enter', function () {
                if (item.method === 'link') requestUrl(item.url, true);
                else Lampa.Player.play({ title: item.title, url: item.url, quality: item.qualitys, voice_name: item.voice_name, isonline: true });
            });
            scroll.append(h);
        });
        Lampa.Controller.enable('content');
    }

    function requestUrl(u, h) {
        u = applySkazAuth(u);
        network.native(u, function(s){
            var v = parseHtml(s, u);
            if(v.length) { if(h) history.push(u); render(v); } else empty();
        }, empty, false, {dataType:'text'});
    }

    function request() {
        var urls = buildUrls(), i=0;
        function next() {
            var u = urls[i++];
            if(!u) return empty();
            network.native(u, function(s){
                var v = parseHtml(s, u);
                if(v.length) render(v); else next();
            }, next, false, {dataType:'text'});
        }
        if(urls.length) next(); else empty();
    }

    function empty() { scroll.clear(); scroll.append(Lampa.Template.get('lampac_does_not_answer', {})); }

    this.start = function () {
        request();
        Lampa.Controller.add('content', {
            toggle: function () { Lampa.Controller.collectionSet(scroll.render(), files.render()); Lampa.Controller.collectionFocus(last || false, scroll.render()); },
            back: function () { if(history.length) requestUrl(history.pop(), false); else Lampa.Activity.backward(); }
        });
        Lampa.Controller.toggle('content');
    };
    this.render = function () { return files.render(); };
    this.destroy = function () { network.clear(); scroll.destroy(); files.destroy(); };
}

// --- ПРИНУДИТЕЛЬНАЯ ВСТАВКА КНОПКИ ---
function addForceButton() {
    Lampa.Listener.follow('full', function (e) {
        if (e.type === 'complite') {
            // Ищем ряд кнопок в карточке фильма
            var buttons = e.object.activity.render().find('.view--torrent');
            
            // Если не нашли "view--torrent" (иногда бывает view--online), ищем просто список кнопок
            if (buttons.length === 0) buttons = e.object.activity.render().find('.button--play').parent();
            
            if (buttons.length) {
                var btn = Lampa.Template.get('button', {
                    title: SETTINGS.name,
                    icon: SETTINGS.icon
                });
                
                btn.on('hover:enter', function () {
                    Lampa.Activity.push({
                        url: '',
                        title: SETTINGS.name,
                        component: SETTINGS.component,
                        movie: e.object.card
                    });
                });
                
                // Вставляем кнопку после "Смотреть" или "Торренты"
                buttons.append(btn);
                console.log('[SHARA] Button injected into card!');
            }
        }
    });
}

function startPlugin() {
    // 1. Регистрируем компонент
    Lampa.Component.add(SETTINGS.component, component);

    // 2. Добавляем в список плагинов (на всякий случай, для контекстного меню)
    if (!Lampa.Manifest.plugins) Lampa.Manifest.plugins = [];
    Lampa.Manifest.plugins.push({
        type: 'video',
        name: SETTINGS.name,
        component: SETTINGS.component,
        onContextMenu: function () { return { name: 'Смотреть '+SETTINGS.name, description: 'FXAPI' }; },
        onContextLauch: function (object) { Lampa.Activity.push({ title: SETTINGS.name, component: SETTINGS.component, movie: object }); }
    });

    // 3. Активируем принудительную кнопку
    addForceButton();
}

if (window.appready) startPlugin();
else {
    Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') startPlugin();
    });
}

})();

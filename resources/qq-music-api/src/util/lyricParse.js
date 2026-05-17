"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// [01:27.96]
const timeExp = /\[(\d{2,}):(\d{2})(?:\.(\d{2,3}))?]/g;
const TAGREGMAP = {
    title: 'ti',
    artist: 'ar',
    album: 'al',
    offset: 'offset',
    by: 'by',
};
class Lyric {
    lyric;
    tags;
    lines;
    constructor(lyric, tags = {}, lines = []) {
        this.lyric = lyric;
        this.tags = tags;
        this.lines = lines;
        this._init();
    }
    _init() {
        this._initTag();
        this._initLines();
    }
    _initTag() {
        for (const tag in TAGREGMAP) {
            const tagKey = tag;
            const matches = this.lyric.match(new RegExp(`\\[${TAGREGMAP[tagKey]}:([^\\]]*)]`, 'i'));
            this.tags[tag] = matches?.[1] || '';
        }
    }
    _initLines() {
        const lines = this.lyric.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Reset lastIndex because timeExp has 'g' flag
            timeExp.lastIndex = 0;
            let result = timeExp.exec(line);
            while (result !== null) {
                const txt = line.replace(/\[(\d{2,}):(\d{2})(?:\.(\d{2,3}))?]/g, '').trim();
                const time = Number(result[1]) * 60 * 1000 + Number(result[2]) * 1000 + Number(result[3] || 0) * 10;
                if (txt) {
                    this.lines.push({
                        time,
                        txt,
                    });
                }
                result = timeExp.exec(line);
            }
        }
        this.lines.sort((a, b) => {
            return a.time - b.time;
        });
    }
}
function lyricParse(lyricString) {
    return new Lyric(lyricString);
}
exports.default = {
    Lyric,
    lyricParse,
};

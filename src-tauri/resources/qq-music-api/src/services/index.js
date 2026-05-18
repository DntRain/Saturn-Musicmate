"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// album
const getAlbumInfo_1 = __importDefault(require("./album/getAlbumInfo"));
// comments
const getComments_1 = __importDefault(require("./comments/getComments"));
// DigitalAlbum
const getDigitalAlbumLists_1 = __importDefault(require("./digitalAlbum/getDigitalAlbumLists"));
const downloadQQMusic_1 = __importDefault(require("./downloadQQMusic"));
// music
const getLyric_1 = __importDefault(require("./music/getLyric"));
// MV
const getMvByTag_1 = __importDefault(require("./mv/getMvByTag"));
// radio
const getRadioLists_1 = __importDefault(require("./radio/getRadioLists"));
// getTopLists
const getTopLists_1 = __importDefault(require("./rank/getTopLists"));
// search
const getHotKey_1 = __importDefault(require("./search/getHotKey"));
const getSearchByKey_1 = __importDefault(require("./search/getSearchByKey"));
const getSmartbox_1 = __importDefault(require("./search/getSmartbox"));
// singer
const getSimilarSinger_1 = __importDefault(require("./singers/getSimilarSinger"));
const getSingerDesc_1 = __importDefault(require("./singers/getSingerDesc"));
const getSingerMv_1 = __importDefault(require("./singers/getSingerMv"));
const getSingerStarNum_1 = __importDefault(require("./singers/getSingerStarNum"));
const songListCategories_1 = __importDefault(require("./songLists/songListCategories"));
const songListDetail_1 = __importDefault(require("./songLists/songListDetail"));
// song list
const songLists_1 = __importDefault(require("./songLists/songLists"));
// UCommon
const UCommon_1 = __importDefault(require("./UCommon/UCommon"));
exports.default = {
    downloadQQMusic: downloadQQMusic_1.default,
    // search
    getHotKey: getHotKey_1.default,
    getSearchByKey: getSearchByKey_1.default,
    getSmartbox: getSmartbox_1.default,
    // song lists
    songLists: songLists_1.default,
    songListCategories: songListCategories_1.default,
    songListDetail: songListDetail_1.default,
    // MV
    getMvByTag: getMvByTag_1.default,
    // singer
    getSimilarSinger: getSimilarSinger_1.default,
    getSingerMv: getSingerMv_1.default,
    getSingerDesc: getSingerDesc_1.default,
    getSingerStarNum: getSingerStarNum_1.default,
    // radio
    getRadioLists: getRadioLists_1.default,
    // DigitalAlbum
    getDigitalAlbumLists: getDigitalAlbumLists_1.default,
    // music
    getLyric: getLyric_1.default,
    // album
    getAlbumInfo: getAlbumInfo_1.default,
    // comments
    getComments: getComments_1.default,
    // UCommon
    UCommon: UCommon_1.default,
    // getTopLists
    getTopLists: getTopLists_1.default,
};

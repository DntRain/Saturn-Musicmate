"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const observability_1 = require("../util/observability");
const batchGetSongInfo_1 = __importDefault(require("./batchGetSongInfo"));
const batchGetSongLists_1 = __importDefault(require("./batchGetSongLists"));
const cookies_1 = __importDefault(require("./cookies"));
const getAlbumInfo_1 = __importDefault(require("./getAlbumInfo"));
const getComments_1 = __importDefault(require("./getComments"));
const getDigitalAlbumLists_1 = __importDefault(require("./getDigitalAlbumLists"));
const getDownloadQQMusic_1 = __importDefault(require("./getDownloadQQMusic"));
const getHotkey_1 = __importDefault(require("./getHotkey"));
const getImageUrl_1 = __importDefault(require("./getImageUrl"));
const getLyric_1 = __importDefault(require("./getLyric"));
const getMusicPlay_1 = __importDefault(require("./getMusicPlay"));
const getMv_1 = __importDefault(require("./getMv"));
const getMvByTag_1 = __importDefault(require("./getMvByTag"));
const getMvPlay_1 = __importDefault(require("./getMvPlay"));
const getNewDisks_1 = __importDefault(require("./getNewDisks"));
const getRadioLists_1 = __importDefault(require("./getRadioLists"));
const getRanks_1 = __importDefault(require("./getRanks"));
const getRecommend_1 = __importDefault(require("./getRecommend"));
const getSearchByKey_1 = __importDefault(require("./getSearchByKey"));
const getSimilarSinger_1 = __importDefault(require("./getSimilarSinger"));
const getSingerAlbum_1 = __importDefault(require("./getSingerAlbum"));
const getSingerDesc_1 = __importDefault(require("./getSingerDesc"));
const getSingerHotsong_1 = __importDefault(require("./getSingerHotsong"));
const getSingerList_1 = __importDefault(require("./getSingerList"));
const getSingerMv_1 = __importDefault(require("./getSingerMv"));
const getSingerStarNum_1 = __importDefault(require("./getSingerStarNum"));
const getSmartbox_1 = __importDefault(require("./getSmartbox"));
const getSongInfo_1 = __importDefault(require("./getSongInfo"));
const getSongListCategories_1 = __importDefault(require("./getSongListCategories"));
const getSongListDetail_1 = __importDefault(require("./getSongListDetail"));
const getSongLists_1 = __importDefault(require("./getSongLists"));
const getTicketInfo_1 = __importDefault(require("./getTicketInfo"));
const getTopLists_1 = __importDefault(require("./getTopLists"));
const { get: getCookie, set: setCookie } = cookies_1.default;
exports.default = {
    getCookie: (0, observability_1.withControllerLogging)('getCookie', getCookie),
    setCookie: (0, observability_1.withControllerLogging)('setCookie', setCookie),
    getDownloadQQMusic: (0, observability_1.withControllerLogging)('getDownloadQQMusic', getDownloadQQMusic_1.default),
    getHotKey: (0, observability_1.withControllerLogging)('getHotKey', getHotkey_1.default),
    getSearchByKey: (0, observability_1.withControllerLogging)('getSearchByKey', getSearchByKey_1.default),
    getSmartbox: (0, observability_1.withControllerLogging)('getSmartbox', getSmartbox_1.default),
    getSongListCategories: (0, observability_1.withControllerLogging)('getSongListCategories', getSongListCategories_1.default),
    getSongLists: (0, observability_1.withControllerLogging)('getSongLists', getSongLists_1.default),
    batchGetSongLists: (0, observability_1.withControllerLogging)('batchGetSongLists', batchGetSongLists_1.default),
    getSongInfo: (0, observability_1.withControllerLogging)('getSongInfo', getSongInfo_1.default),
    batchGetSongInfo: (0, observability_1.withControllerLogging)('batchGetSongInfo', batchGetSongInfo_1.default),
    getSongListDetail: (0, observability_1.withControllerLogging)('getSongListDetail', getSongListDetail_1.default),
    getNewDisks: (0, observability_1.withControllerLogging)('getNewDisks', getNewDisks_1.default),
    getMvByTag: (0, observability_1.withControllerLogging)('getMvByTag', getMvByTag_1.default),
    getMv: (0, observability_1.withControllerLogging)('getMv', getMv_1.default),
    getSingerList: (0, observability_1.withControllerLogging)('getSingerList', getSingerList_1.default),
    getSimilarSinger: (0, observability_1.withControllerLogging)('getSimilarSinger', getSimilarSinger_1.default),
    getSingerAlbum: (0, observability_1.withControllerLogging)('getSingerAlbum', getSingerAlbum_1.default),
    getSingerHotsong: (0, observability_1.withControllerLogging)('getSingerHotsong', getSingerHotsong_1.default),
    getSingerMv: (0, observability_1.withControllerLogging)('getSingerMv', getSingerMv_1.default),
    getSingerDesc: (0, observability_1.withControllerLogging)('getSingerDesc', getSingerDesc_1.default),
    getSingerStarNum: (0, observability_1.withControllerLogging)('getSingerStarNum', getSingerStarNum_1.default),
    getRadioLists: (0, observability_1.withControllerLogging)('getRadioLists', getRadioLists_1.default),
    getDigitalAlbumLists: (0, observability_1.withControllerLogging)('getDigitalAlbumLists', getDigitalAlbumLists_1.default),
    getLyric: (0, observability_1.withControllerLogging)('getLyric', getLyric_1.default),
    getMusicPlay: (0, observability_1.withControllerLogging)('getMusicPlay', getMusicPlay_1.default),
    getAlbumInfo: (0, observability_1.withControllerLogging)('getAlbumInfo', getAlbumInfo_1.default),
    getComments: (0, observability_1.withControllerLogging)('getComments', getComments_1.default),
    getRecommend: (0, observability_1.withControllerLogging)('getRecommend', getRecommend_1.default),
    getMvPlay: (0, observability_1.withControllerLogging)('getMvPlay', getMvPlay_1.default),
    getTopLists: (0, observability_1.withControllerLogging)('getTopLists', getTopLists_1.default),
    getRanks: (0, observability_1.withControllerLogging)('getRanks', getRanks_1.default),
    getTicketInfo: (0, observability_1.withControllerLogging)('getTicketInfo', getTicketInfo_1.default),
    getImageUrl: (0, observability_1.withControllerLogging)('getImageUrl', getImageUrl_1.default),
};

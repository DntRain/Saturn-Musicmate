"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const koa_router_1 = __importDefault(require("koa-router"));
const router = new koa_router_1.default();
const controllers_1 = __importDefault(require("../controllers"));
// cookies
router.get('/user/getCookie', controllers_1.default.getCookie);
router.get('/user/setCookie', controllers_1.default.setCookie);
// downloadQQMusic
router.get('/downloadQQMusic', controllers_1.default.getDownloadQQMusic);
router.get('/getHotkey', controllers_1.default.getHotKey);
router.get('/getSearchByKey/:key?/:limit?/:page?/:catZhida?', controllers_1.default.getSearchByKey);
// search smartbox
router.get('/getSmartbox/:key?', controllers_1.default.getSmartbox);
// 1
router.get('/getSongListCategories', controllers_1.default.getSongListCategories);
router.get('/getSongLists/:page?/:limit?/:categoryId?/:sortId?', controllers_1.default.getSongLists);
router.post('/batchGetSongLists', controllers_1.default.batchGetSongLists);
// getSongInfo
router.get('/getSongInfo/:songmid?/:songid?', controllers_1.default.getSongInfo);
router.post('/batchGetSongInfo', controllers_1.default.batchGetSongInfo);
// 4
// disstid=7011264340
router.get('/getSongListDetail/:disstid?', controllers_1.default.getSongListDetail);
// newDisk
router.get('/getNewDisks/:page?/:limit?', controllers_1.default.getNewDisks);
// getMvByTag
router.get('/getMvByTag', controllers_1.default.getMvByTag);
// MV
// area_id=15&version_id=7
router.get('/getMv/:area_id?/:version_id?/:limit?/:page?', controllers_1.default.getMv);
// getSingerList
router.get('/getSingerList/:area?/:sex?/:genre?/:index?/:page?', controllers_1.default.getSingerList);
// getSimilarSinger
// singermid=0025NhlN2yWrP4
router.get('/getSimilarSinger/:singermid?', controllers_1.default.getSimilarSinger);
// getSingerAlbum
// singermid=0025NhlN2yWrP4
router.get('/getSingerAlbum/:singermid?/:limit?/:page?', controllers_1.default.getSingerAlbum);
router.get('/getSingerHotsong/:singermid?/:limit?/:page?', controllers_1.default.getSingerHotsong);
/**
 * @description: getSingerMv
 * @param order: time(fan upload) || listen(singer all)
 */
router.get('/getSingerMv/:singermid?/:limit?/:order?', controllers_1.default.getSingerMv);
router.get('/getSingerDesc/:singermid?', controllers_1.default.getSingerDesc);
router.get('/getSingerStarNum/:singermid?', controllers_1.default.getSingerStarNum);
// radio
router.get('/getRadioLists', controllers_1.default.getRadioLists);
// DigitalAlbum
router.get('/getDigitalAlbumLists', controllers_1.default.getDigitalAlbumLists);
// music
// getLyric
// songmid=003rJSwm3TechU
router.get('/getLyric/:songmid?/:isFormat?', controllers_1.default.getLyric);
// songmid=003rJSwm3TechU
router.get('/getMusicPlay/:songmid?', controllers_1.default.getMusicPlay);
// album
// albummid=0016l2F430zMux
router.get('/getAlbumInfo/:albummid?', controllers_1.default.getAlbumInfo);
router.get('/getComments/:id?/:rootcommentid?/:cid?/:pagesize?/:pagenum?/:cmd?/:reqtype?/:biztype?', controllers_1.default.getComments);
// recommend
router.get('/getRecommend', controllers_1.default.getRecommend);
// mv play
router.get('/getMvPlay/:vid?', controllers_1.default.getMvPlay);
// rankList: getTopLists
router.get('/getTopLists', controllers_1.default.getTopLists);
// ranks
router.get('/getRanks/:topId?/:limit?/:page?', controllers_1.default.getRanks);
// ticket
router.get('/getTicketInfo', controllers_1.default.getTicketInfo);
// getImageUrl
router.get('/getImageUrl', controllers_1.default.getImageUrl);
exports.default = router;

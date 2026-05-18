"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const observability_1 = require("../../util/observability");
const u_common_1 = __importDefault(require("../u_common"));
// Musicmate patch: the legacy /soso/fcgi-bin/client_search_cp endpoint now
// always returns 500 from QQ. Route through u.y.qq.com/musicu.fcg with the
// music.adaptor.SearchAdaptor module and reshape the response to the legacy
// {response.data.song.list} envelope so existing callers keep working.
const upstream = 'u.y.qq.com/cgi-bin/musicu.fcg [music.adaptor.SearchAdaptor]';
exports.default = ({ method = 'get', params = {}, option = {} }) => {
    const query = String(params.w ?? '');
    const numPerPage = Number(params.n) || 10;
    const pageNum = Number(params.p) || 1;
    const upstreamPayload = {
        comm: { ct: 24, cv: 0, format: 'json', platform: 'yqq.json' },
        req_1: {
            module: 'music.adaptor.SearchAdaptor',
            method: 'do_search_v2',
            param: {
                query,
                num_per_page: numPerPage,
                page_num: pageNum,
                search_type: 0,
                grp: 1,
            },
        },
    };
    (0, observability_1.logServiceRequest)('getSearchByKey', upstream, { query, numPerPage, pageNum });
    const options = Object.assign(option, {
        params: { data: JSON.stringify(upstreamPayload) },
    });
    return (0, u_common_1.default)({ method, options })
        .then((res) => {
        const items = res?.data?.req_1?.data?.body?.item_song?.items || [];
        const list = items.map((item) => ({
            ...item,
            // Legacy aliases the controller and Rust parser expect
            songmid: item.mid,
            songname: item.title || item.name,
            songid: item.id,
            albumname: item?.album?.name || item?.album?.title,
            albummid: item?.album?.mid,
        }));
        const response = {
            code: 0,
            data: {
                keyword: query,
                song: {
                    list,
                    totalnum: list.length,
                    curnum: list.length,
                    curpage: pageNum,
                },
            },
        };
        (0, observability_1.logServiceSuccess)('getSearchByKey', upstream, response, { keyword: query });
        return {
            status: 200,
            body: { response },
        };
    })
        .catch((error) => {
        (0, observability_1.logServiceFailure)('getSearchByKey', upstream, error, { query });
        return {
            status: 500,
            body: { error },
        };
    });
};

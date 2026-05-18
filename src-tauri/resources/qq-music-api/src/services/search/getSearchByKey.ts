import { AxiosRequestConfig } from 'axios';
import { logServiceFailure, logServiceRequest, logServiceSuccess } from '../../util/observability';
import u_common from '../u_common';

interface GetSearchByKeyParams {
  method?: string;
  params?: Record<string, unknown>;
  option?: AxiosRequestConfig;
}

// Musicmate patch: the legacy /soso/fcgi-bin/client_search_cp endpoint now
// always returns 500 from QQ. Route through u.y.qq.com/musicu.fcg with the
// music.adaptor.SearchAdaptor module and reshape the response to the legacy
// {response.data.song.list} envelope so existing callers keep working.
const upstream = 'u.y.qq.com/cgi-bin/musicu.fcg [music.adaptor.SearchAdaptor]';

export default ({ method = 'get', params = {}, option = {} }: GetSearchByKeyParams) => {
  const query = String((params as Record<string, unknown>).w ?? '');
  const numPerPage = Number((params as Record<string, unknown>).n) || 10;
  const pageNum = Number((params as Record<string, unknown>).p) || 1;

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
  logServiceRequest('getSearchByKey', upstream, { query, numPerPage, pageNum });

  const options: AxiosRequestConfig = Object.assign(option, {
    params: { data: JSON.stringify(upstreamPayload) },
  });

  return u_common({ method, options })
    .then((res: import('axios').AxiosResponse<any>) => {
      const items: any[] = res?.data?.req_1?.data?.body?.item_song?.items || [];
      const list = items.map((item: any) => ({
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
      logServiceSuccess('getSearchByKey', upstream, response, { keyword: query });
      return {
        status: 200,
        body: { response },
      };
    })
    .catch((error: unknown) => {
      logServiceFailure('getSearchByKey', upstream, error, { query });
      return {
        status: 500,
        body: { error },
      };
    });
};

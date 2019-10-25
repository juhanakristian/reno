import {
  ServerRequest,
  Response
} from "https://deno.land/std@v0.20.0/http/server.ts";

import { writeCookies } from "./cookies.ts";
import parsePath from "./pathparser.ts";

export type AugmentedRequest = Pick<
  ServerRequest,
  Exclude<keyof ServerRequest, "respond">
> & {
  queryParams: URLSearchParams;
  routeParams: string[];
};

export type AugmentedResponse = Response & {
  cookies?: Map<string, string>;
};

/* The function returned by
 * createRouter that performs
 * route lookups. Better name? */
export type RouteParser = (
  req: ServerRequest
) => AugmentedResponse | Promise<AugmentedResponse>;

/* A user-defined handler for
 * a particular route. */
export type RouteHandler<TRequest = AugmentedRequest> = (
  req: TRequest,
  rootQueryParams?: URLSearchParams,
  childPathParts?: string[]
) => Response | Promise<Response>;

export type Router = (routes: RouteMap) => RouteParser;

// TODO: write createRouteMap func for consistency
export class RouteMap extends Map<RegExp | string, RouteHandler> {}
export class NotFoundError extends Error {} // TODO: rename RouteMissingError?

export const createAugmentedRequest = (
  { body, bodyStream, ...rest }: ServerRequest | AugmentedRequest,
  queryParams: URLSearchParams,
  routeParams: string[]
): AugmentedRequest => ({
  ...rest,
  body,
  bodyStream,
  queryParams,
  routeParams
});

export const routerCreator = (
  pathParser: typeof parsePath,
  cookieWriter: typeof writeCookies,
) =>
  (routes: RouteMap) => async (
    req: ServerRequest | AugmentedRequest,
    rootQueryParams?: URLSearchParams,
    childPathParts?: string[]
  ) => {
    const url = new URL(childPathParts ? childPathParts.join('/') : req.url, "https://");
    const queryParams = rootQueryParams || url.searchParams;

    for (let [path, handler] of routes) {
      const matches = url.pathname.match(pathParser(path));

      if (matches) {
        const res = await handler(
          createAugmentedRequest(req, queryParams, matches.slice(1)),
          queryParams,
          matches.slice(1)
        );

        /* TODO: remove this condition and write
         * a common response wrapper */
        if (res instanceof Response) {
          cookieWriter(res);
        }

        return res;
      }
    }

    return Promise.reject(new NotFoundError(`No match for ${req.url}`));
  };

export const createRouter = routerCreator(parsePath, writeCookies);

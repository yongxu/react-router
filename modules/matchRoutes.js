import { loopAsync } from './AsyncUtils';
import { matchPattern } from './PatternUtils';

function getChildRoutes(route, location, callback) {
  if (route.childRoutes) {
    callback(null, route.childRoutes);
  } else if (route.getChildRoutes) {
    route.getChildRoutes(location, callback);
  } else {
    callback();
  }
}

function getIndexRoute(route, location, callback) {
  if (route.indexRoute) {
    callback(null, route.indexRoute);
  } else if (route.getIndexRoute) {
    route.getIndexRoute(location, callback);
  } else {
    callback();
  }
}

function assignParams(params, paramNames, paramValues) {
  return paramNames.reduceRight(function (params, paramName, index) {
    var paramValue = paramValues && paramValues[index];

    if (Array.isArray(params[paramName])) {
      params[paramName].unshift(paramValue);
    } else if (paramName in params) {
      params[paramName] = [ paramValue, params[paramName] ];
    } else {
      params[paramName] = paramValue;
    }

    return params;
  }, params);
}

function createParams(paramNames, paramValues) {
  return assignParams({}, paramNames, paramValues);
}

function matchRouteDeep(basename, route, location, callback) {
  var pattern = route.path || '';

  if (pattern.indexOf('/') !== 0)
    pattern = basename.replace(/\/*$/, '/') + pattern; // Relative paths build on the parent's path.

  var { remainingPathname, paramNames, paramValues } = matchPattern(pattern, location.pathname);
  var isExactMatch = remainingPathname === '';

  if (isExactMatch && route.path) {
    var match = {
      routes: [ route ],
      params: createParams(paramNames, paramValues)
    };

    getIndexRoute(route, location, function (error, indexRoute) {
      if (error) {
        callback(error);
      } else {
        if (indexRoute)
          match.routes.push(indexRoute);

        callback(null, match);
      }
    });
  } else if (remainingPathname != null || route.childRoutes) {
    // Either a) this route matched at least some of the path or b)
    // we don't have to load this route's children asynchronously. In
    // either case continue checking for matches in the subtree.
    getChildRoutes(route, location, function (error, childRoutes) {
      if (error) {
        callback(error);
      } else if (childRoutes) {
        // Check the child routes to see if any of them match.
        matchRoutes(childRoutes, location, function (error, match) {
          if (error) {
            callback(error);
          } else if (match) {
            // A child route matched! Augment the match and pass it up the stack.
            match.routes.unshift(route);
            callback(null, match);
          } else {
            callback();
          }
        }, pattern);
      } else {
        callback();
      }
    });
  } else {
    callback();
  }
}

/**
 * Asynchronously matches the given location to a set of routes and calls
 * callback(error, state) when finished. The state object will have the
 * following properties:
 *
 * - routes       An array of routes that matched, in hierarchical order
 * - params       An object of URL parameters
 *
 * Note: This operation may finish synchronously if no routes have an
 * asynchronous getChildRoutes method.
 */
function matchRoutes(routes, location, callback, basename='') {
  loopAsync(routes.length, function (index, next, done) {
    matchRouteDeep(basename, routes[index], location, function (error, match) {
      if (error || match) {
        done(error, match);
      } else {
        next();
      }
    });
  }, callback);
}

export default matchRoutes;

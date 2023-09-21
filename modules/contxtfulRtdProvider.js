/**
 * Contxtful Technologies Inc
 * This RTD module provides receptivity feature that can be accessed using the
 * getReceptivity() function. The value returned by this function enriches the ad-units
 * that are passed within the `getTargetingData` functions and GAM.
 *
 */

import { submodule } from '../src/hook.js';
import {
  logInfo,
  logError,
  isStr,
  isEmptyStr,
  buildUrl,
} from '../src/utils.js';
import { loadExternalScript } from '../src/adloader.js';

const MODULE_NAME = 'contxtful';
const MODULE = `${MODULE_NAME}RtdProvider`;

const CONTXTFUL_RECEPTIVITY_DOMAIN = 'api.receptivity.io';

let initialReceptivity = null;
let contxtfulModule = null;

/**
 * Init function used to start sub module
 * @param { { params: { version: String, customer: String } } } config
 * @return { Boolean }
 */
function init(config) {
  logInfo(MODULE, 'init', config);
  initialReceptivity = null;
  contxtfulModule = null;

  try {
    const {version, customer} = extractParameters(config);
    initCustomer(version, customer);
    return true;
  } catch (error) {
    logError(MODULE, error);
    return false;
  }
}

/**
 * Extract required configuration for the sub module.
 * validate that all required configuration are present and are valid.
 * Throws an error if any config is missing of invalid.
 * @param { { params: { version: String, customer: String } } } config
 * @return { { version: String, customer: String } }
 * @throws params.{name} should be a non-empty string
 */
function extractParameters(config) {
  const version = config?.params?.version;
  if (!isStr(version) || isEmptyStr(version)) {
    throw Error(`${MODULE}: params.version should be a non-empty string`);
  }

  const customer = config?.params?.customer;
  if (!isStr(customer) || isEmptyStr(customer)) {
    throw Error(`${MODULE}: params.customer should be a non-empty string`);
  }

  return {version, customer};
}

/**
 * Initialize sub module for a customer.
 * This will load the external resources for the sub module.
 * @param { String } version
 * @param { String } customer
 */
function initCustomer(version, customer) {
  const CONNECTOR_URL = buildUrl({
    protocol: 'https',
    host: CONTXTFUL_RECEPTIVITY_DOMAIN,
    pathname: `/${version}/prebid/${customer}/connector/p.js`,
  });

  const externalScript = loadExternalScript(CONNECTOR_URL, MODULE_NAME);
  addExternalScriptEventListener(externalScript);
}

/**
 * Add event listener to the script tag for the expected events from the external script.
 * @param { HTMLScriptElement } script
 */
function addExternalScriptEventListener(script) {
  if (!script) {
    return;
  }

  script.addEventListener('initialReceptivity', ({ detail }) => {
    let receptivityState = detail?.ReceptivityState;
    if (isStr(receptivityState) && !isEmptyStr(receptivityState)) {
      initialReceptivity = receptivityState;
      setGoogletagTargetingData(getReceptivity());
    }
  });

  script.addEventListener('rxEngineIsReady', ({ detail: api }) => {
    contxtfulModule = api;
  });
}

/**
 * Return current receptivity.
 * @return { { ReceptivityState: String } }
 */
function getReceptivity() {
  return {
    ReceptivityState: contxtfulModule?.GetReceptivity()?.ReceptivityState || initialReceptivity
  };
}

/**
 * Call googletag manager to add the ReceptivityState as a targeting data for the page
 * @param { { ReceptivityState: String } } receptivity
 */
function setGoogletagTargetingData({ReceptivityState: receptivityState}) {
  if (!window.googletag) {
    return;
  }

  window.googletag.cmd = window.googletag.cmd || []
  window.googletag.cmd.push(() => {
    window.googletag.pubads().setTargeting('ReceptivityState', receptivityState);
  })
}

/**
 * Add targeting data for GAM before bid request
 * @param {*} _reqBidsConfigObj
 * @param { Function } callback
 * @param {*} _config
 * @param {*} _userConsent
 */
function getBidRequestData(_reqBidsConfigObj, callback, _config, _userConsent) {
  logInfo(MODULE, 'getBidRequestData');
  setGoogletagTargetingData(getReceptivity());

  callback();
}

/**
 * Set targeting data for ad server
 * @param { [String] } adUnits
 * @param {*} _config
 * @param {*} _userConsent
*  @return {{ code: { ReceptivityState: String } }}
 */
function getTargetingData(adUnits, _config, _userConsent) {
  logInfo(MODULE, 'getTargetingData');
  if (!adUnits) {
    return {};
  }

  const receptivity = getReceptivity();
  if (!receptivity?.ReceptivityState) {
    return {};
  }

  return adUnits.reduce((targets, code) => {
    targets[code] = receptivity;
    return targets;
  }, {});
}

export const contxtfulSubmodule = {
  name: MODULE_NAME,
  init,
  extractParameters,
  getBidRequestData,
  getTargetingData,
};

submodule('realTimeData', contxtfulSubmodule);

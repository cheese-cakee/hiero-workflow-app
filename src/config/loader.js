// SPDX-License-Identifier: Apache-2.0

/**
 * Configuration loader for the Hiero Workflow App.
 *
 * Responsibilities:
 * 1. Fetch repository configuration via Probot's `context.config()`,
 *    which automatically resolves `_extends` inheritance from the org-level
 *    `.github` repository.
 * 2. Validate the parsed configuration against the JSON Schema.
 * 3. Deep-merge with `safeDefaults` so that every module key exists even when
 *    a repository only overrides a subset of properties.
 * 4. Graceful degradation: if the config file is missing, malformed, or
 *    invalid, return `safeDefaults` and log a clear warning. The App never
 *    crashes due to bad configuration.
 *
 * @module config/loader
 */

const { createConfigValidator } = require('./schema');
const { safeDefaults } = require('./defaults');

// Reuse a single compiled validator across invocations.
const validate = createConfigValidator();

/**
 * Recursively merges `source` into `target`.
 *
 * - Objects are merged property-by-property.
 * - Arrays in `source` replace arrays in `target` (no concatenation).
 * - Primitive values in `source` overwrite those in `target`.
 * - `null` values in `source` delete the corresponding key in `target`.
 *
 * @param {object} target - The base object (e.g., safeDefaults).
 * @param {object} source - The object to merge on top (e.g., repo config).
 * @returns {object} A new object representing the deep merge.
 */
function deepMerge(target, source) {
  if (source === null || source === undefined) {
    return target;
  }

  if (typeof source !== 'object' || Array.isArray(source)) {
    return source;
  }

  const result = { ...target };

  for (const key of Object.keys(source)) {
    const sourceValue = source[key];

    if (sourceValue === null) {
      delete result[key];
      continue;
    }

    if (
      typeof sourceValue === 'object' &&
      sourceValue !== null &&
      !Array.isArray(sourceValue) &&
      typeof result[key] === 'object' &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key], sourceValue);
    } else {
      result[key] = sourceValue;
    }
  }

  return result;
}

/**
 * Loads, validates, and merges repository configuration.
 *
 * @param {import('probot').Context} context - The Probot event context.
 * @param {import('probot').Logger} logger - A Probot logger instance.
 * @returns {Promise<object>} The resolved configuration object.
 */
async function loadConfig(context, logger) {
  let rawConfig = null;

  try {
    // Probot's context.config() fetches hiero-bot.yml from the repo,
    // automatically resolves _extends, and caches the result.
    rawConfig = await context.config('hiero-bot.yml');
  } catch (error) {
    logger.warn({ error: error.message }, 'Failed to load hiero-bot.yml');
  }

  if (rawConfig === null || rawConfig === undefined) {
    logger.info('No hiero-bot.yml found; using safe defaults');
    return deepMerge({}, safeDefaults);
  }

  // Ajv mutates the input to inject defaults, so we clone first.
  const configToValidate = deepMerge({}, rawConfig);
  const valid = validate(configToValidate);

  if (!valid) {
    const errors = validate.errors.map(err => ({
      path: err.instancePath || 'root',
      message: err.message,
    }));

    logger.warn({ errors }, 'Invalid hiero-bot.yml; using safe defaults');
    return deepMerge({}, safeDefaults);
  }

  // Deep-merge safe defaults underneath the validated config so that
  // partially-specified modules still inherit missing nested defaults.
  const finalConfig = deepMerge(safeDefaults, configToValidate);

  logger.debug({ config: finalConfig }, 'Loaded and validated configuration');

  return finalConfig;
}

module.exports = {
  loadConfig,
  deepMerge,
};

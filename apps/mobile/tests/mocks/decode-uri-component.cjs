// decode-uri-component 0.5 ships ESM only. Jest's CommonJS runtime cannot
// parse it, so tests use this equivalent CommonJS shim.
module.exports = function decodeUriComponent(encodedURI) {
  return globalThis.decodeURIComponent(encodedURI)
}
module.exports.default = module.exports

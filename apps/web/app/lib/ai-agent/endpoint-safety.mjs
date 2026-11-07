import ipaddr from "ipaddr.js";

export function validateHttpsEndpoint(value) {
  let url;
  try { url=new URL(value); } catch { throw new Error("Endpoint HTTPS tidak valid."); }
  if (url.protocol!=="https:"||url.username||url.password||url.search||url.hash||(url.port&&url.port!=="443")) throw new Error("Endpoint harus HTTPS publik pada port standar.");
  return url;
}

export function isPublicUnicastAddress(address) {
  try { return ipaddr.process(address).range()==="unicast"; } catch { return false; }
}

export function createPinnedLookup(hostname, address, family) {
  return (lookupHostname, options, callback) => {
    if (lookupHostname.toLowerCase() !== hostname.toLowerCase()) {
      const error = new Error("Pinned endpoint hostname mismatch.");
      error.code = "ENOTFOUND";
      callback(error);
      return;
    }
    if (options?.all === true) {
      callback(null, [{ address, family }]);
      return;
    }
    callback(null, address, family);
  };
}

export function assertNoRedirect(response) {
  if (response.status>=300&&response.status<400) throw new Error("Provider redirect is not allowed.");
  return response;
}

var https = require('https');
var dns = require('dns');
var forge = require('node-forge');

try {
    // Extract form data from request
    var pfxFile = context.getVariable('request.formdata.pfxFile');
    var pfxPassword = context.getVariable('request.formdata.pfxPassword');
    var targetUrl = context.getVariable('request.formdata.targetUrl');
    var targetPath = context.getVariable('request.formdata.targetPath') || '/'; // Default to '/' if not provided
    var targetMethod = context.getVariable('request.formdata.targetMethod') || 'GET'; // Default to 'GET' if not provided
    var tlsVersion = context.getVariable('request.formdata.tlsVersion') || 'TLSv1_2_method'; // Default to TLS 1.2

    // Decode PFX file
    var p12Asn1 = forge.asn1.fromDer(pfxFile);
    var p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, pfxPassword);

    var keyObj, certObj;
    p12.safeContents.forEach(function(safeContents) {
        safeContents.safeBags.forEach(function(safeBag) {
            if (safeBag.type === forge.pki.oids.certBag) {
                certObj = forge.pki.certificateToPem(safeBag.cert);
            } else if (safeBag.type === forge.pki.oids.keyBag) {
                keyObj = forge.pki.privateKeyToPem(safeBag.key);
            }
        });
    });

    // Validate that both key and certificate are extracted
    if (!keyObj || !certObj) {
        throw new Error("Invalid PFX file or password. Could not extract key and certificate.");
    }

    // Set extracted key and certificate to context variables
    context.setVariable('privateKey', keyObj);
    context.setVariable('certificate', certObj);

    // Extract hostname from the target URL
    var url = new URL(targetUrl);
    var hostname = url.hostname;

    // DNS Resolution Test
    dns.lookup(hostname, function(err, address, family) {
        if (err) {
            context.setVariable('dnsResolution', 'Failed: ' + err.message);
        } else {
            context.setVariable('dnsResolution', 'Success: ' + address + ', Family: ' + family);

            // Connectivity Test and TLS Handshake
            var options = {
                hostname: hostname,
                port: 443,
                path: targetPath,
                method: targetMethod,
                key: keyObj,
                cert: certObj,
                rejectUnauthorized: false, // For testing only. Set to true in production.
                secureProtocol: tlsVersion // Specify TLS version
            };

            var req = https.request(options, function(res) {
                context.setVariable('tlsResponseCode', res.statusCode);
                context.setVariable('tlsResponseMessage', res.statusMessage);
                res.on('data', function(chunk) {
                    // Consume response data to free up memory
                });
                res.on('end', function() {
                    context.setVariable('tlsHandshake', 'Success');
                });
            });

            req.on('error', function(e) {
                context.setVariable('tlsHandshake', 'Failed: ' + e.message);
            });

            req.end();
        }
    });

} catch (e) {
    // Handle errors
    context.setVariable('error', e.message);
    context.setVariable('dnsResolution', 'N/A');
    context.setVariable('tlsHandshake', 'Failed');
    context.setVariable('tlsResponseCode', 'N/A');
    context.setVariable('tlsResponseMessage', 'N/A');
}

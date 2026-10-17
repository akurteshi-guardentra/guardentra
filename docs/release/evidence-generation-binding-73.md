# Evidence generation binding (#73)

Source correction for release candidate `42dd54200b60cc697590ad611f82cda56c7f6b7d`. This does not close #73 or #124 and is not hosted scanner acceptance.

Scanner downloads read object metadata, keep the generation as an exact decimal string, and send that generation on the media request. A missing or invalid generation returns before any unscoped read. A pinned read that answers 404 or 412 is not retried against the latest object. Checksum mismatch and the existing size limit still fail closed.

Reviewer, portal, and organization-attachment downloads keep their separate permission checks. Each signed URL is built from the generation the server just read, using Storage V4 with the existing five-minute expiry. A generation supplied on the request is not the signing generation. V2 is not used, because this installed SDK appends a V2 generation query after the string-to-sign.

The installed client is `@google-cloud/storage` 7.21.0. Its file constructor copies a generation through `Number()`. The adapters write the original string back onto the file handle before the request so integers above `2^53-1` stay exact. Tests stub transport and signing. They do not prove a live Cloud Storage service.

Rollback: revert this change. No data migration is involved.

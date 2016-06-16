/*
 * Copyright 2016 The MITRE Corporation, All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this work except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

module.exports = {
    "required": true,
    "type": "object",
    "properties": {
        // Web settings
        "port": {
            "minimum": 1,
            "maximum": 65535,
            "type": "number"
        },
        "domain": {
            "required": true,
            "type": "string"
        },
        "use_tls": {
            "required": true,
            "type": "boolean"
        },
        "use_suite_b": {
            "default": true,
            "type": "boolean"
        },
        "tls_keystore_file": {
            "type": "string"
        },
        "tls_keystore_pass": {
            "type": "string"
        },
        "proxy_careshare": {
            "type": "string"
//            "format": "url"
        },
        "proxy_fhir": {
            "type": "string"
//            "format": "url"
        },
        "proxy_openid": {
            "type": "string"
//            "format": "url"
        },
        "proxy_api": {
            "type": "string"
//            "format": "url"
        },
        "nomination_service": {
            "type": "string"
//            "format": "url"
        },
        "transcript_service": {
            "type": "string"
//            "format": "url"
        },

        // Database settings
        "db": {
            "required": true,
            "type": "object",
            "properties": {
                "production": {
                    "required": true,
                    "type": "string"
//                    "format": "url"
                },
                "test": {
                    "required": true,
                    "type": "string"
//                    "format": "url"
                }
            }
        },

        // Authentication settings
        "jwt_ttl": {
            "required": true,
            "type": "integer"
        },
        "jwt_secret": {
            "required": true,
            "type": "string"
        },
        "jwt_signing_alg": {
            "required": true,
            "type": "string",
            "enum": ['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512']
        },

        // OpenID Connect settings
        "openid_client_id": {
            "required": true,
            "type": "string"
        },
        "openid_client_secret": {
            "required": true,
            "type": "string"
        },
        "openid_url_authorization": {
            "required": true,
            "type": "string"
        },
        "openid_url_token": {
            "required": true,
            "type": "string"
        },
        "openid_url_user_info": {
            "required": true,
            "type": "string"
        },

        // Logging settings
        "log_file": {
            "required": true,
            "type": "string"
        },
        "log_level": {
            "type": "string",
            "enum": ["silly", "debug", "verbose", "info", "warn", "error"]
        },

        // Miscellaneous settings
        "admin_user": {
            "type": "string"
        },
        "admin_password": {
            "type": "string"
        }
    }
};

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
            "enum": [ 'RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512' ]
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
        "openid_url_base": {
            "required": true,
            "type": "string"
//            "format": "url"
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
        "careshare_url_base": {
            "required": true,
            "type": "string"
//            "format": "url"
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
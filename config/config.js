module.exports = {
    /**
     * Millis conversions cheat sheet:
     * 1 second: 1000
     * 1 minute: 60000
     * 10 minutes: 600000
     * 30 minutes: 1800000
     * 1 hour: 3600000
     * 12 hours: 43200000
     * 24 hours: 86400000
     * 1 week: 604800000
     */
    port: 3000,
    ttl: 3600000, // 1 hour
    resetTokenExpiresMinutes: 20, // 20 minutes later
    tokenSecret: 'TOKENsecretHERE',
    mongoUrl: 'mongodb://localhost/careauth',
    adminUser: 'admin@mitre.org',
    adminPassword: undefined // leaving this undefined will generate a random password
};

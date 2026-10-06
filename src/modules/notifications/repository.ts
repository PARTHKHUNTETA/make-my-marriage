// All MongoDB access for the notifications module. Every method takes the request context and
// applies weddingId itself; there is no unscoped find. The only file that may call getDb().
export {};

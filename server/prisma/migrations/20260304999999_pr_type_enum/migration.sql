-- PRType was never CREATE TYPE'd in earlier migrations; 20260305000000 only ALTER ADD values.
-- Single-line CREATE avoids statement-splitting issues on shadow DB.

CREATE TYPE "PRType" AS ENUM ('MATERIAL', 'SERVICE', 'COMMERCIAL', 'PRODUCTION', 'PROJECT', 'OFFICE');

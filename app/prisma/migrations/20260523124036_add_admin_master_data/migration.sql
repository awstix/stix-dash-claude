-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "shortcut" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleNumber" TEXT NOT NULL,
    "licensePlate" TEXT,
    "vehicleType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "isSpecialVehicle" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MaterialType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "materialNumber" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "unit" TEXT NOT NULL DEFAULT 't',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AsphaltMixType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mixNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "unit" TEXT NOT NULL DEFAULT 't',
    "category" TEXT,
    "plant" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ConcreteType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "typeNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "strengthClass" TEXT,
    "exposureClass" TEXT,
    "aggregate" TEXT,
    "consistency" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'm3',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Driver_shortcut_key" ON "Driver"("shortcut");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_vehicleNumber_key" ON "Vehicle"("vehicleNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_licensePlate_key" ON "Vehicle"("licensePlate");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialType_materialNumber_key" ON "MaterialType"("materialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AsphaltMixType_mixNumber_key" ON "AsphaltMixType"("mixNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ConcreteType_typeNumber_key" ON "ConcreteType"("typeNumber");

-- AlterTable
ALTER TABLE `Product` ADD COLUMN `lengthOption` VARCHAR(191) NULL DEFAULT 'Length',
    ADD COLUMN `widthOption` VARCHAR(191) NULL DEFAULT 'Width';

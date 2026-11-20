-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: warehouse-management-db-laminhtri-9a7a.l.aivencloud.com    Database: defaultdb
-- ------------------------------------------------------
-- Server version	8.4.11

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `company_fund_adjustments`
--

DROP TABLE IF EXISTS `company_fund_adjustments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `company_fund_adjustments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `method` varchar(20) NOT NULL,
  `previous_balance` decimal(14,2) NOT NULL,
  `new_balance` decimal(14,2) NOT NULL,
  `reason` text NOT NULL,
  `created_at` datetime NOT NULL,
  `employee_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_company_fund_adjustments_method` (`method`),
  KEY `ix_company_fund_adjustments_employee_id` (`employee_id`),
  CONSTRAINT `fk_company_fund_adjustments_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_company_fund_adjustments_method` FOREIGN KEY (`method`) REFERENCES `company_funds` (`method`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `company_fund_adjustments`
--

LOCK TABLES `company_fund_adjustments` WRITE;
/*!40000 ALTER TABLE `company_fund_adjustments` DISABLE KEYS */;
/*!40000 ALTER TABLE `company_fund_adjustments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `company_fund_entries`
--

DROP TABLE IF EXISTS `company_fund_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `company_fund_entries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `method` varchar(20) NOT NULL,
  `direction` varchar(3) NOT NULL,
  `entry_type` varchar(30) NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `balance_after` decimal(14,2) NOT NULL,
  `occurred_at` datetime NOT NULL,
  `source_type` varchar(30) NOT NULL,
  `source_id` int NOT NULL,
  `description` varchar(255) NOT NULL,
  `employee_id` int NOT NULL,
  `note` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_company_fund_entry_source` (`source_type`,`source_id`),
  KEY `ix_company_fund_entries_method_date` (`method`,`occurred_at`),
  KEY `ix_company_fund_entries_employee_id` (`employee_id`),
  CONSTRAINT `fk_company_fund_entries_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_company_fund_entries_method` FOREIGN KEY (`method`) REFERENCES `company_funds` (`method`) ON DELETE RESTRICT,
  CONSTRAINT `ck_company_fund_entry_amount` CHECK ((`amount` > 0)),
  CONSTRAINT `ck_company_fund_entry_direction` CHECK ((`direction` in (_utf8mb4'in',_utf8mb4'out')))
) ENGINE=InnoDB AUTO_INCREMENT=107 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `company_fund_entries`
--

LOCK TABLES `company_fund_entries` WRITE;
/*!40000 ALTER TABLE `company_fund_entries` DISABLE KEYS */;
INSERT INTO `company_fund_entries` VALUES (101,'cash','in','opening',1200000000.00,1200000000.00,'2026-11-05 03:07:57','opening',1,'Số dư ban đầu',4,NULL),(102,'bank_transfer','in','opening',600000000.00,600000000.00,'2026-11-05 03:07:57','opening',2,'Số dư ban đầu',4,NULL),(103,'cash','out','operating_expense',30000.00,1199970000.00,'2026-11-08 20:27:16','operating_expense',2,'Sửa xe #2',4,'sjvbndhifvbsahxc'),(104,'cash','in','operating_expense_void',30000.00,1200000000.00,'2026-11-08 20:33:29','operating_expense_void',2,'Hoàn khoản chi #2',4,'ấn lộn'),(105,'cash','out','operating_expense',15000000.00,1185000000.00,'2026-11-13 20:05:13','operating_expense',3,'Lương nhân viên #3',4,'trả lương tài xế'),(106,'cash','out','operating_expense',5000000.00,1180000000.00,'2026-11-18 20:22:59','operating_expense',4,'Sửa xe #4',4,'sửa xe');
/*!40000 ALTER TABLE `company_fund_entries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `company_funds`
--

DROP TABLE IF EXISTS `company_funds`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `company_funds` (
  `method` varchar(20) NOT NULL,
  `opening_balance` decimal(14,2) NOT NULL,
  `balance` decimal(14,2) NOT NULL,
  `opened_at` datetime NOT NULL,
  `opened_by_id` int NOT NULL,
  PRIMARY KEY (`method`),
  KEY `ix_company_funds_opened_by_id` (`opened_by_id`),
  CONSTRAINT `fk_company_funds_opened_by` FOREIGN KEY (`opened_by_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `ck_company_fund_balance` CHECK ((`balance` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `company_funds`
--

LOCK TABLES `company_funds` WRITE;
/*!40000 ALTER TABLE `company_funds` DISABLE KEYS */;
INSERT INTO `company_funds` VALUES ('bank_transfer',600000000.00,600000000.00,'2026-11-05 03:07:57',4),('cash',1200000000.00,1180000000.00,'2026-11-05 03:07:57',4);
/*!40000 ALTER TABLE `company_funds` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customer_payments`
--

DROP TABLE IF EXISTS `customer_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer_payments` (
  `amount` decimal(14,2) NOT NULL,
  `payment_type` enum('INVOICE','OLD_DEBT') NOT NULL,
  `payment_method` enum('cash','bank_transfer') NOT NULL,
  `paid_at` datetime NOT NULL,
  `note` text,
  `customer_id` int NOT NULL,
  `sales_invoice_id` int DEFAULT NULL,
  `employee_id` int NOT NULL,
  `id` int NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id`),
  KEY `ix_customer_payments_customer_id` (`customer_id`),
  KEY `ix_customer_payments_sales_invoice_id` (`sales_invoice_id`),
  KEY `ix_customer_payments_employee_id` (`employee_id`),
  KEY `ix_customer_payments_customer_date` (`customer_id`,`paid_at`),
  KEY `ix_customer_payments_method_date` (`payment_method`,`paid_at`),
  CONSTRAINT `customer_payments_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `customer_payments_ibfk_2` FOREIGN KEY (`sales_invoice_id`) REFERENCES `sales_invoices` (`id`) ON DELETE SET NULL,
  CONSTRAINT `customer_payments_ibfk_3` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `ck_customer_payment_amount` CHECK ((`amount` > 0))
) ENGINE=InnoDB AUTO_INCREMENT=255 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customer_payments`
--

LOCK TABLES `customer_payments` WRITE;
/*!40000 ALTER TABLE `customer_payments` DISABLE KEYS */;
/*!40000 ALTER TABLE `customer_payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customers`
--

DROP TABLE IF EXISTS `customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customers` (
  `full_name` varchar(150) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `address` text NOT NULL,
  `sales_area_id` int DEFAULT NULL,
  `debt_amount` decimal(14,2) NOT NULL,
  `id` int NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_customers_phone` (`phone`),
  KEY `ix_customers_sales_area_id` (`sales_area_id`),
  KEY `ix_customers_debt_amount` (`debt_amount`),
  CONSTRAINT `customers_ibfk_1` FOREIGN KEY (`sales_area_id`) REFERENCES `sales_areas` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `ck_customer_debt` CHECK ((`debt_amount` >= 0))
) ENGINE=InnoDB AUTO_INCREMENT=279 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customers`
--

LOCK TABLES `customers` WRITE;
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
/*!40000 ALTER TABLE `customers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `damage_report_items`
--

DROP TABLE IF EXISTS `damage_report_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `damage_report_items` (
  `quantity` decimal(18,3) NOT NULL,
  `damage_reason` varchar(255) DEFAULT NULL,
  `damage_report_id` int NOT NULL,
  `product_id` int NOT NULL,
  `id` int NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_damage_report_product` (`damage_report_id`,`product_id`),
  KEY `ix_damage_report_items_damage_report_id` (`damage_report_id`),
  KEY `ix_damage_report_items_product_id` (`product_id`),
  CONSTRAINT `damage_report_items_ibfk_1` FOREIGN KEY (`damage_report_id`) REFERENCES `damage_reports` (`id`) ON DELETE CASCADE,
  CONSTRAINT `damage_report_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `ck_damage_report_item_qty` CHECK ((`quantity` > 0))
) ENGINE=InnoDB AUTO_INCREMENT=481 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `damage_report_items`
--

LOCK TABLES `damage_report_items` WRITE;
/*!40000 ALTER TABLE `damage_report_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `damage_report_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `damage_reports`
--

DROP TABLE IF EXISTS `damage_reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `damage_reports` (
  `reported_at` datetime NOT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `status` enum('PENDING','APPROVED','REJECTED') NOT NULL,
  `note` text,
  `review_note` text,
  `warehouse_id` int NOT NULL,
  `reported_by_employee_id` int NOT NULL,
  `reviewed_by_employee_id` int DEFAULT NULL,
  `id` int NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id`),
  KEY `ix_damage_reports_reviewed_by_employee_id` (`reviewed_by_employee_id`),
  KEY `ix_damage_reports_warehouse_status_date` (`warehouse_id`,`status`,`reported_at`),
  KEY `ix_damage_reports_reported_by_employee_id` (`reported_by_employee_id`),
  KEY `ix_damage_reports_warehouse_id` (`warehouse_id`),
  KEY `ix_damage_reports_status` (`status`),
  CONSTRAINT `damage_reports_ibfk_1` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `damage_reports_ibfk_2` FOREIGN KEY (`reported_by_employee_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `damage_reports_ibfk_3` FOREIGN KEY (`reviewed_by_employee_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=224 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `damage_reports`
--

LOCK TABLES `damage_reports` WRITE;
/*!40000 ALTER TABLE `damage_reports` DISABLE KEYS */;
/*!40000 ALTER TABLE `damage_reports` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employee_stocks`
--

DROP TABLE IF EXISTS `employee_stocks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee_stocks` (
  `quantity` decimal(18,3) NOT NULL DEFAULT '0.000',
  `updated_at` datetime NOT NULL,
  `employee_id` int NOT NULL,
  `product_id` int NOT NULL,
  `id` int NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_employee_stock_product` (`employee_id`,`product_id`),
  KEY `ix_employee_stocks_product_id` (`product_id`),
  KEY `ix_employee_stocks_employee_id` (`employee_id`),
  KEY `ix_employee_stocks_employee_product` (`employee_id`,`product_id`),
  CONSTRAINT `employee_stocks_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `employee_stocks_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `ck_employee_stock_qty` CHECK ((`quantity` >= 0))
) ENGINE=InnoDB AUTO_INCREMENT=235 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employee_stocks`
--

LOCK TABLES `employee_stocks` WRITE;
/*!40000 ALTER TABLE `employee_stocks` DISABLE KEYS */;
/*!40000 ALTER TABLE `employee_stocks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employees`
--

DROP TABLE IF EXISTS `employees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employees` (
  `full_name` varchar(150) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `username` varchar(50) NOT NULL,
  `email` varchar(120) NOT NULL,
  `password_hash` varchar(200) NOT NULL,
  `role` enum('KE_TOAN','NHAN_VIEN_BAN_HANG','THU_KHO','QUAN_LY','NHAN_VIEN_GIAO_HANG') NOT NULL,
  `is_locked` tinyint(1) NOT NULL,
  `is_approved` tinyint(1) NOT NULL,
  `approved_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `warehouse_id` int DEFAULT NULL,
  `id` int NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_employees_username` (`username`),
  UNIQUE KEY `ix_employees_email` (`email`),
  UNIQUE KEY `ix_employees_phone` (`phone`),
  KEY `ix_employees_warehouse_id` (`warehouse_id`),
  KEY `ix_employees_is_approved` (`is_approved`),
  CONSTRAINT `employees_ibfk_1` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employees`
--

LOCK TABLES `employees` WRITE;
/*!40000 ALTER TABLE `employees` DISABLE KEYS */;
INSERT INTO `employees` VALUES ('Nguyễn Văn An','0900000001','nguyenvanan','tranvanha@gmail.com','$2b$12$CjbYUGSaWwghyne8ydXyXOADoVrPB9/Z8dPeZCIGWT3.SAa39hp5i','NHAN_VIEN_BAN_HANG',0,1,'2026-10-23 19:43:53','2026-10-23 19:43:54',NULL,1),('Lê Văn Kho','0900000003','thukho','levankho@example.com','$2b$12$4BLoaGb0orYzoj9NAeJabOJzYgnYOjsR42Q2jz8dTz0E8N5FnZnYi','THU_KHO',0,1,'2026-10-23 19:43:53','2026-10-23 19:43:54',NULL,2),('Phạm Thu Hà','0900000005','ketoan','phamthuha@example.com','$2b$12$PuH1Q7wruuSuQ1LmJ3jyveQOlEkdzqLWPIRev2yAThGabAoRkaP7m','KE_TOAN',0,1,'2026-10-23 19:43:53','2026-10-23 19:43:54',NULL,3),('Trần Minh Quản','0900000004','quanly','tranminhquan@example.com','$2b$12$6iLwMWyyy3C0Reu/EUEHzuYW29pj/W7L3svZ47YwKcCGe4shSyNdC','QUAN_LY',0,1,'2026-10-23 19:43:54','2026-10-23 19:43:54',NULL,4),('Test nhân viên bán hàng 1','0335351401','test_sales_01','tranvanha975285@gmail.com','$2b$12$IlaEHDB317vHDdnqhHxRa.MLVGpSJoQdG6ENyx.hwYB1zSZ02sOHC','NHAN_VIEN_BAN_HANG',0,1,'2026-10-23 19:50:22','2026-10-23 19:48:08',NULL,5),('Trần Thủ Kho','0903975285','test_thukho_1','tranquochuy79713@gmail.com','$2b$12$a5RCmqplYfLkrTICdTkb8.rKryRFjFv.ppH9213/QAp3hryq4RwYe','THU_KHO',0,1,'2026-10-23 19:50:15','2026-10-23 19:49:09',NULL,6),('Trần Kế Toán','0142441422','test_ketoan_1','2351010080huy@ou.edu.vn','$2b$12$Ytjj1Tlhyz9ob7uWaRp9pumIqzNw626oJUY3/HXOcwkFZAabtP4Yi','KE_TOAN',0,1,'2026-10-23 19:50:08','2026-10-23 19:49:52',NULL,7),('min01','0888423468','ctuhoc7072','132@gmail.com','$2b$12$ttsewH/YhjXwPO1WfKhyte5XJLMjEfhqK0S22YDnlaZRxf/rVYTAO','NHAN_VIEN_BAN_HANG',0,1,'2026-10-23 16:53:09','2026-10-23 16:46:46',NULL,8),('Nguyễn Văn An','0990000201','giaohang_deploy_01','giaohang.deploy01@example.invalid','$2b$12$e7yQC5ZMCH8248nJJZuZLuYmMwPlqjWpFihxTgiE8vjgiyZTkH1dO','NHAN_VIEN_GIAO_HANG',0,1,'2026-11-02 02:55:54','2026-11-02 02:55:54',NULL,9),('Trần Minh Khôi','0990000202','giaohang_deploy_02','giaohang.deploy02@example.invalid','$2b$12$dvkU2lLQMxUYdFapzCKsaenOSDSaIuo8o71rGXePT920AqePJvyse','NHAN_VIEN_GIAO_HANG',0,1,'2026-11-02 02:55:54','2026-11-02 02:55:54',NULL,10),('Lê Quốc Bảo','0990000203','giaohang_deploy_03','giaohang.deploy03@example.invalid','$2b$12$Az9FlQhsnZ0HAtW3kzYpMutO3D.3qcJb68lfuhpie/yXQT1yiPpm.','NHAN_VIEN_GIAO_HANG',0,1,'2026-11-02 02:55:54','2026-11-02 02:55:54',NULL,11),('Phạm Thị Hương','0990000204','giaohang_deploy_04','giaohang.deploy04@example.invalid','$2b$12$keU3jdRaCDPm6xKGjGIeAu3R9omuHdEKwhuXVgAT54Caghmx/6/qS','NHAN_VIEN_GIAO_HANG',1,1,'2026-11-02 02:55:54','2026-11-02 02:55:54',NULL,12),('Võ Hoàng Nam','0990000205','giaohang_deploy_05','giaohang.deploy05@example.invalid','$2b$12$4XemEFBlfrpWmZwriJywfO859TCHyX7S2lB07EiIya8K2wAVxbVie','NHAN_VIEN_GIAO_HANG',1,1,'2026-11-02 02:55:54','2026-11-02 02:55:54',NULL,13);
/*!40000 ALTER TABLE `employees` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `expense_categories`
--

DROP TABLE IF EXISTS `expense_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `expense_categories` (
  `code` varchar(24) NOT NULL,
  `name` varchar(120) NOT NULL,
  `created_at` datetime NOT NULL,
  `created_by_id` int NOT NULL,
  `expense_type` varchar(12) NOT NULL DEFAULT 'incidental',
  PRIMARY KEY (`code`),
  UNIQUE KEY `uq_expense_categories_name` (`name`),
  KEY `ix_expense_categories_created_by_id` (`created_by_id`),
  CONSTRAINT `fk_expense_categories_created_by` FOREIGN KEY (`created_by_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expense_categories`
--

LOCK TABLES `expense_categories` WRITE;
/*!40000 ALTER TABLE `expense_categories` DISABLE KEYS */;
/*!40000 ALTER TABLE `expense_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `import_invoice_items`
--

DROP TABLE IF EXISTS `import_invoice_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `import_invoice_items` (
  `quantity` decimal(18,3) NOT NULL,
  `unit_price` decimal(14,2) NOT NULL,
  `import_invoice_id` int NOT NULL,
  `product_id` int NOT NULL,
  `id` int NOT NULL AUTO_INCREMENT,
  `line_total` decimal(14,2) DEFAULT NULL,
  `entered_unit` varchar(50) DEFAULT NULL,
  `entered_quantity` decimal(18,3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_import_item_product` (`import_invoice_id`,`product_id`),
  KEY `ix_import_invoice_items_product_id` (`product_id`),
  KEY `ix_import_invoice_items_import_invoice_id` (`import_invoice_id`),
  CONSTRAINT `import_invoice_items_ibfk_1` FOREIGN KEY (`import_invoice_id`) REFERENCES `import_invoices` (`id`) ON DELETE CASCADE,
  CONSTRAINT `import_invoice_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `ck_import_item_price` CHECK ((`unit_price` >= 0)),
  CONSTRAINT `ck_import_item_qty` CHECK ((`quantity` > 0))
) ENGINE=InnoDB AUTO_INCREMENT=681 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `import_invoice_items`
--

LOCK TABLES `import_invoice_items` WRITE;
/*!40000 ALTER TABLE `import_invoice_items` DISABLE KEYS */;
INSERT INTO `import_invoice_items` VALUES (1200.000,3800.00,238,277,680,4560000.00,NULL,NULL);
/*!40000 ALTER TABLE `import_invoice_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `import_invoices`
--

DROP TABLE IF EXISTS `import_invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `import_invoices` (
  `imported_at` datetime NOT NULL,
  `note` text,
  `warehouse_id` int NOT NULL,
  `supplier_id` int NOT NULL,
  `employee_id` int NOT NULL,
  `id` int NOT NULL AUTO_INCREMENT,
  `combo_groups` json DEFAULT NULL,
  `inbound_fee` decimal(14,2) NOT NULL DEFAULT '0.00',
  `deductible_input_vat` decimal(14,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`id`),
  KEY `ix_import_invoices_warehouse_id` (`warehouse_id`),
  KEY `ix_import_invoices_supplier_date` (`supplier_id`,`imported_at`),
  KEY `ix_import_invoices_employee_id` (`employee_id`),
  KEY `ix_import_invoices_warehouse_date` (`warehouse_id`,`imported_at`),
  KEY `ix_import_invoices_supplier_id` (`supplier_id`),
  CONSTRAINT `import_invoices_ibfk_1` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `import_invoices_ibfk_2` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `import_invoices_ibfk_3` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=239 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `import_invoices`
--

LOCK TABLES `import_invoices` WRITE;
/*!40000 ALTER TABLE `import_invoices` DISABLE KEYS */;
INSERT INTO `import_invoices` VALUES ('2026-11-13 00:00:00','',9,267,4,238,'null',0.00,0.00);
/*!40000 ALTER TABLE `import_invoices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_settings`
--

DROP TABLE IF EXISTS `inventory_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_settings` (
  `id` int NOT NULL,
  `low_stock_percentage` decimal(5,2) NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `ck_inventory_low_stock_percentage` CHECK (((`low_stock_percentage` >= 1) and (`low_stock_percentage` <= 100)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_settings`
--

LOCK TABLES `inventory_settings` WRITE;
/*!40000 ALTER TABLE `inventory_settings` DISABLE KEYS */;
INSERT INTO `inventory_settings` VALUES (1,20.00);
/*!40000 ALTER TABLE `inventory_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `operating_expenses`
--

DROP TABLE IF EXISTS `operating_expenses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `operating_expenses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `category` varchar(24) NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `occurred_on` date NOT NULL,
  `invoice_id` int DEFAULT NULL,
  `description` varchar(500) NOT NULL,
  `payment_method` varchar(20) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `created_by_id` int NOT NULL,
  `voided_at` datetime DEFAULT NULL,
  `voided_by_id` int DEFAULT NULL,
  `void_reason` varchar(500) DEFAULT NULL,
  `is_abnormal` tinyint(1) NOT NULL DEFAULT '0',
  `allocation_basis` varchar(12) NOT NULL DEFAULT 'revenue',
  `trip_invoice_ids` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_operating_expense_manager` (`created_by_id`),
  KEY `fk_operating_expense_void_manager` (`voided_by_id`),
  KEY `ix_operating_expenses_date_id` (`occurred_on`,`id`),
  KEY `ix_operating_expenses_invoice_date` (`invoice_id`,`occurred_on`),
  KEY `ix_operating_expenses_category_date` (`category`,`occurred_on`),
  CONSTRAINT `fk_operating_expense_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `sales_invoices` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_operating_expense_manager` FOREIGN KEY (`created_by_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_operating_expense_void_manager` FOREIGN KEY (`voided_by_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `ck_operating_expense_amount` CHECK ((`amount` > 0)),
  CONSTRAINT `ck_operating_expense_category` CHECK ((`category` in (_utf8mb4'fuel',_utf8mb4'vehicle_repair',_utf8mb4'lodging',_utf8mb4'sales_salary',_utf8mb4'other')))
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `operating_expenses`
--

LOCK TABLES `operating_expenses` WRITE;
/*!40000 ALTER TABLE `operating_expenses` DISABLE KEYS */;
INSERT INTO `operating_expenses` VALUES (2,'vehicle_repair',30000.00,'2026-11-08',NULL,'sjvbndhifvbsahxc','cash','2026-11-08 20:27:16',4,'2026-11-08 20:33:29',4,'ấn lộn',0,'revenue',NULL),(3,'sales_salary',15000000.00,'2026-11-13',NULL,'trả lương tài xế','cash','2026-11-13 20:05:13',4,NULL,NULL,NULL,0,'revenue',NULL),(4,'vehicle_repair',5000000.00,'2026-11-18',NULL,'thay vỏ xe','cash','2026-11-18 20:22:59',4,NULL,NULL,NULL,1,'revenue',NULL);
/*!40000 ALTER TABLE `operating_expenses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pricing_cycles`
--

DROP TABLE IF EXISTS `pricing_cycles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pricing_cycles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `start_date` date NOT NULL,
  `updated_at` datetime NOT NULL,
  `updated_by_id` int NOT NULL,
  `planned_salary_amount` decimal(14,2) DEFAULT NULL,
  `planned_revenue_amount` decimal(14,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `updated_by_id` (`updated_by_id`),
  CONSTRAINT `pricing_cycles_ibfk_1` FOREIGN KEY (`updated_by_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pricing_cycles`
--

LOCK TABLES `pricing_cycles` WRITE;
/*!40000 ALTER TABLE `pricing_cycles` DISABLE KEYS */;
/*!40000 ALTER TABLE `pricing_cycles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pricing_policies`
--

DROP TABLE IF EXISTS `pricing_policies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pricing_policies` (
  `product_id` int NOT NULL,
  `planned_quantity` decimal(22,3) NOT NULL DEFAULT '100.000',
  `target_margin` decimal(5,2) NOT NULL DEFAULT '20.00',
  `updated_at` datetime NOT NULL,
  `updated_by_id` int NOT NULL,
  `desired_profit_per_unit` decimal(14,2) DEFAULT NULL,
  `reference_price` decimal(14,2) DEFAULT NULL,
  `rounding_step` int NOT NULL DEFAULT '1000',
  PRIMARY KEY (`product_id`),
  KEY `fk_pricing_manager` (`updated_by_id`),
  CONSTRAINT `fk_pricing_manager` FOREIGN KEY (`updated_by_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_pricing_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ck_pricing_planned_quantity` CHECK ((`planned_quantity` > 0)),
  CONSTRAINT `ck_pricing_target_margin` CHECK (((`target_margin` >= 0) and (`target_margin` < 100)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pricing_policies`
--

LOCK TABLES `pricing_policies` WRITE;
/*!40000 ALTER TABLE `pricing_policies` DISABLE KEYS */;
INSERT INTO `pricing_policies` VALUES (279,100.000,10.00,'2026-11-06 22:42:50',4,NULL,NULL,1000);
/*!40000 ALTER TABLE `pricing_policies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_combo_items`
--

DROP TABLE IF EXISTS `product_combo_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_combo_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `combo_id` int NOT NULL,
  `product_id` int NOT NULL,
  `quantity` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_product_combo_item` (`combo_id`,`product_id`),
  KEY `ix_product_combo_items_combo_id` (`combo_id`),
  KEY `ix_product_combo_items_product_id` (`product_id`),
  CONSTRAINT `fk_product_combo_items_combo` FOREIGN KEY (`combo_id`) REFERENCES `product_combos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_product_combo_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `ck_product_combo_item_quantity` CHECK ((`quantity` > 0))
) ENGINE=InnoDB AUTO_INCREMENT=133 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_combo_items`
--

LOCK TABLES `product_combo_items` WRITE;
/*!40000 ALTER TABLE `product_combo_items` DISABLE KEYS */;
INSERT INTO `product_combo_items` VALUES (128,32,278,1),(129,32,279,10),(130,32,280,6),(131,32,281,96),(132,32,282,6);
/*!40000 ALTER TABLE `product_combo_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_combos`
--

DROP TABLE IF EXISTS `product_combos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_combos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  `sale_price` decimal(14,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_product_combos_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_combos`
--

LOCK TABLES `product_combos` WRITE;
/*!40000 ALTER TABLE `product_combos` DISABLE KEYS */;
INSERT INTO `product_combos` VALUES (32,'Bộ rèm định vị',561111.00);
/*!40000 ALTER TABLE `product_combos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_requests`
--

DROP TABLE IF EXISTS `product_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `unit` varchar(50) NOT NULL,
  `note` text,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `resolved_at` datetime DEFAULT NULL,
  `requested_by_employee_id` int NOT NULL,
  `resolved_product_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_product_requests_status` (`status`),
  KEY `ix_product_requests_status_created` (`status`,`created_at`),
  KEY `ix_product_requests_requested_by` (`requested_by_employee_id`),
  KEY `ix_product_requests_resolved_product` (`resolved_product_id`),
  CONSTRAINT `fk_product_requests_requested_by` FOREIGN KEY (`requested_by_employee_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_product_requests_resolved_product` FOREIGN KEY (`resolved_product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=227 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_requests`
--

LOCK TABLES `product_requests` WRITE;
/*!40000 ALTER TABLE `product_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `product_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `name` varchar(255) NOT NULL,
  `unit` varchar(50) NOT NULL,
  `default_sale_price` decimal(14,2) NOT NULL,
  `id` int NOT NULL AUTO_INCREMENT,
  `unit_conversions` json DEFAULT NULL,
  `weight_per_unit` decimal(14,3) DEFAULT NULL,
  `volume_per_unit` decimal(14,3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  CONSTRAINT `ck_product_price` CHECK ((`default_sale_price` >= 0))
) ENGINE=InnoDB AUTO_INCREMENT=377 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES ('Bát 10p trắng','Cái',4500.00,277,NULL,NULL,NULL),('Cây định vị - 1716','Cây',195000.00,278,NULL,NULL,NULL),('Bát 18','Cái',1200.00,279,NULL,NULL,NULL),('Đầu cây vuông','Cái',1500.00,280,NULL,NULL,NULL),('Bi định vị','Viên',2600.00,281,NULL,NULL,NULL),('Dây định vị','Mét',7500.00,282,NULL,NULL,NULL),('Bát 10p nâu','Cái',500.00,283,NULL,NULL,NULL),('Bát trần trắng','Cái',500.00,284,NULL,NULL,NULL),('Bát trần nâu','Cái',500.00,285,NULL,NULL,NULL),('Bát 16p trắng','cái',500.00,286,NULL,NULL,NULL),('Bát 16p nâu','Cái',500.00,287,NULL,NULL,NULL),('Bát 2.6p Trắng','Cái',500.00,288,NULL,NULL,NULL),('Bát 2.6p nâu','Cái',500.00,289,NULL,NULL,NULL),('Bát 20p Trắng','Cái',500.00,290,NULL,NULL,NULL),('Bát 20p nâu','Cái',500.00,291,NULL,NULL,NULL),('Bát 23p Trắng','Cái',500.00,292,NULL,NULL,NULL),('Bát 23p nâu','Cái',500.00,293,NULL,NULL,NULL),('Bát có nhựa trắng','Cái',500.00,294,NULL,NULL,NULL),('Bát có nhựa nâu','Cái',500.00,295,NULL,NULL,NULL),('Khoen trắng to','Bịch',500.00,296,NULL,NULL,NULL),('Khoen nâu to','Bịch',500.00,297,NULL,NULL,NULL),('Khoen nhỏ trắng','Bịch',500.00,298,NULL,NULL,NULL),('Khoen xám','cái',500.00,299,NULL,NULL,NULL),('Đầu Thổi Trắng','Cái',500.00,300,NULL,NULL,NULL),('Đầu thổi nâu','Cái',500.00,301,NULL,NULL,NULL),('Đầu lá trắng','Cái',500.00,302,NULL,NULL,NULL),('Đầu lá nâu','Cái',500.00,303,NULL,NULL,NULL),('Đầu bông mai trắng','Cái',500.00,304,NULL,NULL,NULL),('Đầu bông mai nâu','Cái',500.00,305,NULL,NULL,NULL),('Bi trượt 820','Viên',500.00,306,NULL,NULL,NULL),('Bịt trắng','Cái',500.00,307,NULL,NULL,NULL),('Bịt nâu','Cái',500.00,308,NULL,NULL,NULL),('Chén trắng','Cái',500.00,309,NULL,NULL,NULL),('Chén nâu','Cái',500.00,310,NULL,NULL,NULL),('Móc đồng','Bịch',500.00,311,NULL,NULL,NULL),('Móc sắt','Bịch',500.00,312,NULL,NULL,NULL),('Móc định vị','Bịch',500.00,313,NULL,NULL,NULL),('Vít 3','Kg',500.00,314,NULL,NULL,NULL),('Vít 4','Kg',500.00,315,NULL,NULL,NULL),('Vít 5','Kg',500.00,316,NULL,NULL,NULL),('Vít vàng','Kg',500.00,317,NULL,NULL,NULL),('Tắc kê sắt','Bịch',500.00,318,NULL,NULL,NULL),('Keo định vị 8p','Cuộn',500.00,319,NULL,NULL,NULL),('Keo định vị 10p','Cuộn',500.00,320,NULL,NULL,NULL),('Keo lưới 10p','Cuộn',500.00,321,NULL,NULL,NULL),('Keo lưới 10p dày','Cuộn',500.00,322,NULL,NULL,NULL),('Keo Lưới 8p','Cuộn',500.00,323,NULL,NULL,NULL),('Keo lưới 5p','Cuộn',500.00,324,NULL,NULL,NULL),('Keo HQ 1','Cuộn',500.00,325,NULL,NULL,NULL),('Keo HQ 2','Cuộn',500.00,326,NULL,NULL,NULL),('Keo HQ 3','Cuộn',500.00,327,NULL,NULL,NULL),('Keo HQ 56','Cuộn',500.00,328,NULL,NULL,NULL),('Keo Lõi Giấy','Cuộn',500.00,329,NULL,NULL,NULL),('Đâu cây 820','Cái',500.00,330,NULL,NULL,NULL),('Núm Trắng','Bịch',500.00,331,NULL,NULL,NULL),('Núm Nâu','Bịch',500.00,332,NULL,NULL,NULL),('Khoen Kiểu Trắng','Bịch',500.00,333,NULL,NULL,NULL),('Khoen Kiểu Nâu','Bịch',500.00,334,NULL,NULL,NULL),('Ri Đô','Bịch',500.00,335,NULL,NULL,NULL),('Nối Cây Trắng','Cái',500.00,336,NULL,NULL,NULL),('Nối Cây Nâu','Cái',500.00,337,NULL,NULL,NULL),('Góc Trắng','Cái',500.00,338,NULL,NULL,NULL),('Góc Nâu','Cái',500.00,339,NULL,NULL,NULL),('Tắc Kê Xanh','Bịch',5500.00,340,NULL,NULL,NULL),('Tắc Kê Nhựa 5','Bịch',500.00,341,NULL,NULL,NULL),('Tắc Kê Nhựa 4','Bịch',500.00,342,NULL,NULL,NULL),('Cây Chống Ồn 820','Cây',500.00,343,NULL,NULL,NULL),('Cây La Dán','Cây',500.00,344,NULL,NULL,NULL),('Cây Y Uốn','Cây',500.00,345,NULL,NULL,NULL),('BI Y Uốn','Viên',500.00,346,NULL,NULL,NULL),('Bát 10','Cái',500.00,347,NULL,NULL,NULL),('Đầu Y Uốn','Cái',500.00,348,NULL,NULL,NULL),('Cây Uốn 6.7M','Cây',500.00,349,NULL,NULL,NULL),('Đầu Uốn 6.7m','Cái',500.00,350,NULL,NULL,NULL),('Bát 20','Cái',500.00,351,NULL,NULL,NULL),('Bát II 18','Cái',500.00,352,NULL,NULL,NULL),('Bi Trượt Gắn Dây','Mét',500.00,353,NULL,NULL,NULL),('Bi Y Uốn Gắn Dây','Mét',500.00,354,NULL,NULL,NULL),('Bi Định vị Gắn Dây','Mét',500.00,355,NULL,NULL,NULL),('Dây Buộc Xám','Cặp',500.00,356,NULL,NULL,NULL),('Dây Buộc Xanh','Cặp',500.00,357,NULL,NULL,NULL),('Dây Buộc Vàng','Cặp',500.00,358,NULL,NULL,NULL),('Cây Nhôm Trắng TĐ 0.9KG - 0.95kg','Kg',500.00,359,NULL,NULL,NULL),('Cây Nhôm Trắng TĐ 0.96KG - 1KG','Kg',500.00,360,NULL,NULL,NULL),('Cây Nhôm Trắng TĐ 1.01 - 1.05 Kg','Kg',500.00,361,NULL,NULL,NULL),('Cây Nhôm Trắng TĐ 1.06 - 1.1','Kg',500.00,362,NULL,NULL,NULL),('Cây Nhôm Trắng TĐ 1.11 - 1.15','Kg',500.00,363,NULL,NULL,NULL),('Cây Nhôm Trắng TĐ 1.16 - 1.2','Kg',500.00,364,NULL,NULL,NULL),('Cây Nhôm Trắng TĐ 1.21 - 1.25','Kg',500.00,365,NULL,NULL,NULL),('Cây Nhôm Trắng TĐ 1.26 - 1.30','Kg',500.00,366,NULL,NULL,NULL),('Cây Nhôm Trắng TĐ 1.31 - 1.35','Kg',500.00,367,NULL,NULL,NULL),('Cây Nhôm Trắng TĐ 1.36 - 1.4','Kg',500.00,368,NULL,NULL,NULL),('Cây Nhôm Trắng TĐ 1.41 - 1.45','Kg',500.00,369,NULL,NULL,NULL),('Cây Nhôm Trắng TĐ 1.46 - 1.5','Kg',500.00,370,NULL,NULL,NULL),('Cây Nhôm Trắng TĐ 1.51 - 1.55','Kg',500.00,371,NULL,NULL,NULL),('Cây Nhôm Trắng TĐ 1.56 - 1.6','Kg',500.00,372,NULL,NULL,NULL),('Cây Nhôm Trắng TĐ 1.8','Kg',500.00,373,NULL,NULL,NULL),('Bi Cây Vuông','Bịch',500.00,374,NULL,NULL,NULL),('Núm Xám','Bịch',500.00,375,NULL,NULL,NULL),('Núm Đậy Nắp','Bịch',500.00,376,NULL,NULL,NULL);
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `promotions`
--

DROP TABLE IF EXISTS `promotions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `promotions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  `condition_type` varchar(30) NOT NULL,
  `min_quantity` int DEFAULT NULL,
  `min_order_amount` decimal(14,2) DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `discount_type` varchar(20) NOT NULL,
  `discount_value` decimal(14,2) NOT NULL,
  `max_discount_amount` decimal(14,2) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_promotions_name` (`name`),
  KEY `ix_promotions_active_dates` (`is_active`,`start_date`,`end_date`),
  KEY `ix_promotions_created_by` (`created_by`),
  CONSTRAINT `fk_promotions_created_by` FOREIGN KEY (`created_by`) REFERENCES `employees` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `ck_promotion_discount_value` CHECK ((`discount_value` > 0)),
  CONSTRAINT `ck_promotion_max_discount` CHECK (((`max_discount_amount` is null) or (`max_discount_amount` >= 0)))
) ENGINE=InnoDB AUTO_INCREMENT=100 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `promotions`
--

LOCK TABLES `promotions` WRITE;
/*!40000 ALTER TABLE `promotions` DISABLE KEYS */;
/*!40000 ALTER TABLE `promotions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `refresh_sessions`
--

DROP TABLE IF EXISTS `refresh_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `refresh_sessions` (
  `employee_id` int NOT NULL,
  `token_hash` varchar(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `id` int NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_refresh_sessions_token_hash` (`token_hash`),
  KEY `employee_id` (`employee_id`),
  CONSTRAINT `refresh_sessions_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=427 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `refresh_sessions`
--

LOCK TABLES `refresh_sessions` WRITE;
/*!40000 ALTER TABLE `refresh_sessions` DISABLE KEYS */;
INSERT INTO `refresh_sessions` VALUES (4,'f850de707c37f63a949bee58534370e69825a53b8628486e0b8a624a2705c0f7','2026-10-30 12:44:11','2026-10-23 12:58:42','2026-10-23 19:44:11',1),(5,'c697c2826eed172d89fa6d7871c32ca6bb02355d66f90a3ea80d0d9dad6717ed','2026-10-30 12:52:50','2026-10-23 12:52:57','2026-10-23 19:52:50',2),(5,'9c6ff81370969857d9ba6bc1b421c266148b4176a271b08b51dddba4dc1c8c1b','2026-10-30 12:54:09','2026-10-23 13:08:39','2026-10-23 19:54:09',3),(4,'a3f2b60fdd8f9f85ebbcc4a0fc8cebe97ac1e5c7a90ebc2b239d5f836dac7a8e','2026-10-30 12:58:42',NULL,'2026-10-23 19:58:42',4),(5,'c4f732d2b9b8f6ce70c4796f19e907bfad6d45bbcf6cb71682fb3ef4496e56d8','2026-10-30 13:08:39','2026-10-23 13:23:09','2026-10-23 20:08:39',5),(5,'da11911234b55094da9dfe222628694bf235e52e09d66b1440a1f89fd84ed9fd','2026-10-30 13:23:09',NULL,'2026-10-23 20:23:09',6),(3,'1ba3c32ea38bc1e00ad27cda3a643409eef33b6109771400dfa276bdd24a1e6b','2026-10-30 16:38:23',NULL,'2026-10-23 16:38:23',7),(4,'b2534f64ef608ab5fd7988c39334f91cf899ad11a91c19c6eb2de339360a0476','2026-10-30 16:38:47','2026-10-23 16:48:24','2026-10-23 16:38:47',8),(4,'a829ac514f63e2e2690407ff2e727513b49043bc6aece0a2be0eabaca52b50ac','2026-10-30 16:39:05','2026-10-23 16:40:52','2026-10-23 16:39:05',9),(4,'dccdc0c2f90502be17491f712b46d197f1e37be83fec2054b07ae5f5cfd0b56a','2026-10-30 16:42:20','2026-10-23 16:45:16','2026-10-23 16:42:20',10),(1,'47383ac97109d24f8820a17f642e83f8de2ff430a2a37caca8ef0318c372f4f4','2026-10-30 16:42:58',NULL,'2026-10-23 16:42:58',11),(4,'d185393de7d2696cf58ba5d15d25bdcf0b4843a367b8443bfb90414c6737b18f','2026-10-30 16:52:04','2026-10-23 16:53:18','2026-10-23 16:52:04',12),(4,'c5101e6ec8287d1bc7361f3fc2a326084463607291fbd23312c436b46d48b571','2026-10-30 16:53:18','2026-10-23 17:06:34','2026-10-23 16:53:18',13),(1,'c35b557d2554482a8134e3d6579d659d1f32fbdf6e283f058109270e69739d64','2026-10-30 17:00:57',NULL,'2026-10-23 17:00:57',14),(4,'734b0c1ebaf7aa61eaff8bf3a9605092f40719e97fec0b04f10f33c1c8b3f3b6','2026-10-30 17:06:34','2026-10-23 17:07:48','2026-10-23 17:06:35',15),(4,'0377f9b6f9bb3b85abe6b2a0a3c27b1b67a4c162207bef9c08a947c7e4524bb7','2026-10-30 17:07:48','2026-10-24 02:06:39','2026-10-23 17:07:49',16),(4,'d2cf158dbb66412d1e2e404c41fa54de71074a5447a794faea680c78909008b1','2026-10-30 17:24:17',NULL,'2026-10-23 17:24:17',17),(4,'157c0a42e6fc3b20c20826e11e5f2bcefb8c651b1117c380ab9f42ce6d1a3741','2026-10-31 02:06:39','2026-10-24 02:06:48','2026-10-24 02:06:41',18),(4,'0f52decd68a4b563c4e8e0b248174668e059684d9fcb23f7b8b48a5c37f1108b','2026-10-31 02:06:48',NULL,'2026-10-24 02:06:48',19),(8,'f232ead4f0ab76c9cedf64bef757251df8862e4581b53ad8f97fb7601635c240','2026-10-31 02:07:22','2026-10-24 02:13:57','2026-10-24 02:07:22',20),(4,'49922bc10905d6d3d4591ac9057438feb1ad5f1b8b7cb85a53f08373dcc76ded','2026-10-31 02:36:37','2026-10-24 02:51:09','2026-10-24 02:36:37',21),(8,'d25731d0f42c39f527b6938b66c8b6faced13beda9adc051004df0532328afb9','2026-10-31 02:36:48','2026-10-24 02:51:19','2026-10-24 02:36:48',22),(4,'56e300c9423bc2d20e3e8e7bfb6f9807d8cbbd7c4dfd49a17ad70299d0f544b2','2026-10-31 02:37:09','2026-10-24 02:51:39','2026-10-24 02:37:09',23),(4,'6a3c25252c44c4e3f70f0a2fd93cf7f167c3e4f96a6e71dede1a50a08461b197','2026-10-31 02:51:09','2026-10-24 03:04:38','2026-10-24 02:51:10',24),(8,'5a21ce6534836810b2b4a99e327057bca445c39a32a7d87ded6a29bca2384c05','2026-10-31 02:51:19','2026-10-24 03:05:50','2026-10-24 02:51:19',25),(4,'9679351a66e6cbeea5df83cd3b517cdd13ed482aedb84bfcb3ebe1e1a31d7790','2026-10-31 02:51:39','2026-10-24 03:06:11','2026-10-24 02:51:39',26),(4,'66622021f85c84fb9b38abd2c367292926547f386485074bb65b9c300cc013e6','2026-10-31 03:05:25','2026-10-24 03:19:54','2026-10-24 03:05:25',27),(8,'d4df637c32b64310223721800097669c1aac719c69cbd0b2c0a6a7c5821dce84','2026-10-31 03:05:50','2026-10-24 03:20:24','2026-10-24 03:05:51',28),(4,'f4371898c3f7f35ab7b1cba99804c175fbd21aa4865693e0df46828cd349b022','2026-10-31 03:06:11','2026-10-24 03:20:42','2026-10-24 03:06:11',29),(4,'62782c6dbc7f3d9c984888cc6ac730b4c7c8766d000ce020fd8b90bdfb0e7ca3','2026-10-31 03:19:54','2026-10-24 03:34:25','2026-10-24 03:19:55',30),(8,'54c0134404cffa66aefbd611810fda725efa365c5edbcccdb7b10df395b47287','2026-10-31 03:20:24','2026-10-24 03:38:01','2026-10-24 03:20:24',31),(4,'13ed9711d7972a609fd95a6407e667f59f978aebc8ab14d4591e4c034f675e64','2026-10-31 03:20:42',NULL,'2026-10-24 03:20:42',32),(8,'c79dccb812c747bc475048174786b4b320e45763e2ab2e0bba499364501de42e','2026-10-31 03:22:56','2026-10-24 03:23:52','2026-10-24 03:22:56',33),(4,'bd83ce1198e7aea67c74e67d0a4d5b027991d5baa649500b982b51690039c35c','2026-10-31 03:34:25','2026-10-24 03:48:56','2026-10-24 03:34:26',34),(8,'b3667567493d8bdd536376973e06654dbbe885b6275379d40a603312bf581c53','2026-10-31 03:38:01',NULL,'2026-10-24 03:38:02',35),(4,'45e71867a9fdf40b151731730313d4ec74db7c8427a5101542a2cacf42314b9a','2026-10-31 03:38:22','2026-10-24 03:52:51','2026-10-24 03:38:22',36),(4,'1e9216fd70d8370213cc7ef341c4b1cd36b20fedd7d5624c53fb4798aa202043','2026-10-31 03:48:56','2026-10-24 04:03:27','2026-10-24 03:48:57',37),(4,'fb18f1da42b8eff715be221dad2c5c416d0da701bc3c59794af8183d357055fe','2026-10-31 03:52:51','2026-10-24 04:07:23','2026-10-24 03:52:52',38),(4,'f0bb95766a4c3c2583d58ce84b4c7ccc30b371a6b236c5bcbb553b65e8ec8e6b','2026-10-31 04:03:27','2026-10-24 06:31:45','2026-10-24 04:03:28',39),(3,'baa5113d758baa5560f24fa8b99360b8e93d27b3ebae2025138f053c02aca087','2026-10-31 04:04:40',NULL,'2026-10-24 04:04:40',40),(4,'cbe36ab99244028dbe40a35d1de872a7ac2260db7aed38e4d362aa59eaa646a4','2026-10-31 04:07:23','2026-10-24 04:21:54','2026-10-24 04:07:23',41),(4,'4beda0535caf1439e80229fb1d883940e58884bbba041905a79f9174eb2b8dfd','2026-10-31 04:21:54','2026-10-24 04:36:58','2026-10-24 04:21:54',42),(4,'f51f857a5e857925d7e4dd444b761be0f1160026425adb70f6c4de8367e6b846','2026-10-31 04:36:58','2026-10-24 04:51:30','2026-10-24 04:36:59',43),(4,'f4dec3a95600ee250d7e584bec5bfe72c781bce4239980c2f909a72c2fe13fa3','2026-10-31 04:51:30','2026-10-24 05:06:03','2026-10-24 04:51:30',44),(4,'db9a2674c6222e643edf18441bcd2e670dff18487aa0db2059f5c173cee8d676','2026-10-31 05:06:03','2026-10-24 05:20:34','2026-10-24 05:06:03',45),(4,'77aaad1dd39715b5d643edb26f0edbe77d0fba519a81cf00427bef7a8658df2d','2026-10-31 05:20:34','2026-10-24 05:35:05','2026-10-24 05:20:34',46),(4,'b1a7cd6a3fb6ad8be69b5c0db412dd644f3a72bcbf6ce34a5ccd5eb05408e3c2','2026-10-31 05:35:05','2026-10-24 05:49:36','2026-10-24 05:35:05',47),(4,'47f057ec1ef1f03362e6d458b675d556b226ceff38749cac0f9a3054cf6b07b4','2026-10-31 05:49:36','2026-10-24 06:04:08','2026-10-24 05:49:36',48),(4,'3b72dc59514f09e94db80cf181d87d3df247dcaa17270f3da2cd944489c277cc','2026-10-31 06:04:08','2026-10-24 06:18:39','2026-10-24 06:04:08',49),(4,'a497c04b408af944e0b94993b71ed7d1ec16a46c80260d9ae12e577ee738e700','2026-10-31 06:18:39','2026-10-24 06:33:09','2026-10-24 06:18:39',50),(4,'d5aa1c5d2c6cc6ed0a847151c3936871450c270c50fc186cafebf4a71a2767d2','2026-10-31 06:31:45','2026-10-24 06:41:57','2026-10-24 06:31:45',51),(4,'c2cb0a97a334e453cf2cf6df13794ed3a588ac94a03a01cf066e7766bbebe79b','2026-10-31 06:33:09','2026-10-24 06:47:41','2026-10-24 06:33:10',52),(4,'f61b27eb292b802d6bd8bc38e5af185ae2ed89316ddcf2d7b3929efc50fe7ee6','2026-10-31 06:42:04','2026-10-24 06:56:34','2026-10-24 06:42:04',53),(4,'159fae633a7bbd5ca789e719de9eb0cede723e8b8b1106f6d857a2f684980657','2026-10-31 06:47:41','2026-10-24 07:02:11','2026-10-24 06:47:41',54),(4,'01b9f8d476a6f976927ff3f286c90298a3823afff830536bb1dccf575872be21','2026-10-31 06:56:34','2026-10-24 07:11:05','2026-10-24 06:56:34',55),(4,'bca8f17f7a1046bd29e4d5f3a71621c54db4c6b1997691e5ac79fd53f6eee24d','2026-10-31 07:02:11','2026-10-24 07:16:42','2026-10-24 07:02:12',56),(4,'a35236d1efdc3a7321740879c525edc353d92cd0fed0f0e97b0fc02dc24ec80b','2026-10-31 07:11:05','2026-10-24 07:25:37','2026-10-24 07:11:05',57),(4,'b3e919021b3eaeeb2b6c1640e20c227c63838665a19fd8d3fda11d1568ea563c','2026-10-31 07:16:42','2026-10-24 07:31:13','2026-10-24 07:16:43',58),(4,'13928d41e9b864d2f10ffc2cf944ed3d90a9e67377eea7fac21fc1c188918b5c','2026-10-31 07:25:37','2026-10-24 07:40:09','2026-10-24 07:25:37',59),(4,'bf31c39d622843dcefba83109e72196effbaa97ab41ec5c5d3326a9c383c3ffd','2026-10-31 07:31:13','2026-10-24 07:45:45','2026-10-24 07:31:14',60),(4,'d5f15d45e7b2391f9e9969570636951a27e33a5b1993bfa5c21f61ecec331539','2026-10-31 07:40:09','2026-10-24 07:54:40','2026-10-24 07:40:09',61),(4,'4b09c7ff1e46d8cf33fdd542a0695d0ffe845b69556518e430c19c726715f724','2026-10-31 07:45:45','2026-10-24 08:00:15','2026-10-24 07:45:45',62),(4,'d31128f4531d43f5199ccfad7fc102f1a1b771950577264f3d983d04a5a3db04','2026-10-31 07:54:40','2026-10-24 07:55:25','2026-10-24 07:54:41',63),(4,'2926e62c1c5f6316bfdfb56c1d7a8d98e68f60b652965a5f6728d86cc7ff4b54','2026-10-31 07:55:36','2026-10-24 08:10:06','2026-10-24 07:55:36',64),(4,'2f7dbd0133fd52637f08a2a228a0d3b7577f134373815521d254e86c2518702b','2026-10-31 08:00:15','2026-10-24 08:14:46','2026-10-24 08:00:16',65),(4,'a9761017621a45a77e721cd0576797d0d8fdaa8aadb70e66ab2a894870110328','2026-10-31 08:10:06','2026-10-24 08:24:38','2026-10-24 08:10:07',66),(4,'fd87186b6dfc4ed64374c041c62ca89101328461a9957d4fe140d9761819a693','2026-10-31 08:14:46','2026-10-24 08:29:17','2026-10-24 08:14:47',67),(4,'0cb5330e53680d75d5e651d2e6fe1cd009f33f7443e045ab2920270fe2517a0a','2026-10-31 08:24:38','2026-10-24 08:39:13','2026-10-24 08:24:38',68),(4,'d051e084fbe41e29957120d777aaad8b47cc187749c964757e817d662772081d','2026-10-31 08:29:17','2026-10-24 08:43:49','2026-10-24 08:29:18',69),(4,'7f48eedd74714a930df584489af56ca412ff2edc9806f675e5236b0b906cf415','2026-10-31 08:39:13','2026-10-24 08:53:45','2026-10-24 08:39:13',70),(4,'95a8257b3b84d59f6408419e463bb6f724fda8e91b4b17bf3353bb501291dccf','2026-10-31 08:43:49','2026-10-24 08:58:20','2026-10-24 08:43:49',71),(4,'0d42c5eb3d87a2939c994dda0e0834a81cb60da86fe56dc3dbd284ed69b0f4c8','2026-10-31 08:53:45','2026-10-24 09:08:17','2026-10-24 08:53:45',72),(4,'a4155bc6aa238ce1e376d103f5047956c781d3449f357d55d2d366054bf71b8b','2026-10-31 08:58:20','2026-10-24 09:12:51','2026-10-24 08:58:20',73),(4,'63e137047779e02cf0a30354135ac8f414211d5d087e956c29753f50b0b8eb57','2026-10-31 09:08:17','2026-10-24 09:14:07','2026-10-24 09:08:17',74),(4,'da53fcdb1a612311fcd798e464f3704a1bc5c3f632e8fa87ee52c2636b8f30f4','2026-10-31 09:12:51','2026-10-24 09:27:21','2026-10-24 09:12:51',75),(1,'655a9e9d213dada83590f3bfd71e8c4490e8d23163534ba5d1d57337e2fa2fbb','2026-10-31 09:14:46','2026-10-24 09:29:19','2026-10-24 09:14:46',76),(4,'465a90fe997ccfb5bbad95a4bf8ff2d78a311f4b63bbb4a14d27ef0bcf8f6a83','2026-10-31 09:27:21','2026-10-24 09:41:52','2026-10-24 09:27:22',77),(1,'b9118ee87bc4493289bd8cc425ad37637fea82e6d0f7a8c9e5d30282e0e36c9e','2026-10-31 09:29:19','2026-10-24 09:33:40','2026-10-24 09:29:19',78),(4,'ccc3fd9b4f079a0670a4da435e8f82856ab1cb2ad0f358b47a85f780ee23e124','2026-10-31 09:33:46','2026-10-24 09:48:17','2026-10-24 09:33:46',79),(4,'f70a50bb5cc0eac0b37ee303b2b145f3997075a686b6748e27c593cb4f4f815f','2026-10-31 09:41:52',NULL,'2026-10-24 09:41:52',80),(4,'ca1062fbd6308be1179c4c7e8e1258c4a4b1aa802d15fccb9281d508174d8d8d','2026-10-31 09:44:55','2026-10-24 09:59:25','2026-10-24 09:44:55',81),(4,'b993577e2232a8da886f470da61bca4923744a2e8e7d95e51e8fbb29d0528543','2026-10-31 09:48:17',NULL,'2026-10-24 09:48:18',82),(4,'ebfe49a8dceeb25af460c2385d4c1a3cf1be5fd82374e5a0759ec1769603a3af','2026-10-31 09:59:25','2026-10-24 10:13:56','2026-10-24 09:59:25',83),(4,'a3c4dd9135b067031b38ae2e0dee5b74a8f99eeb1d2c3d42073be7f5c6d3a762','2026-10-31 10:13:56','2026-10-24 10:28:26','2026-10-24 10:13:56',84),(1,'830e833b3b01a0cb095c4726a3b78d9d8922090f18b8de39dc1848b670df9ade','2026-10-31 10:26:43',NULL,'2026-10-24 10:26:43',85),(4,'6a20fa1b3dd7044057f21cb022fe1626391144e93b4fa231bc4f37de1b49e637','2026-10-31 10:28:26','2026-10-24 10:42:56','2026-10-24 10:28:26',86),(4,'89d53fa37bc3ab21a9ee53c998e115e227cb7db83bd0c8ed17b1d06c5564b558','2026-10-31 10:42:56','2026-10-24 10:57:57','2026-10-24 10:42:56',87),(4,'a860e2b153f96a53e2dcfbe2a579f12cda44bb492f1d1d3d970c2730340a56a4','2026-10-31 10:54:29','2026-10-26 09:06:25','2026-10-24 10:54:29',88),(4,'78cc8fb48c3b6aa095960f6743edf86d2765c8acf643657fd7556a8120e7d199','2026-10-31 10:57:57','2026-10-24 11:12:30','2026-10-24 10:57:57',89),(4,'6495dfefb3107f183b910da466748ce132b26a384d95fcf3548243391fb8ed2a','2026-10-31 11:12:30','2026-10-24 11:27:01','2026-10-24 11:12:31',90),(4,'6d6b347d1989547f2773c628799536e571f337979b3542b1a80c738932a37347','2026-10-31 11:27:01','2026-10-24 11:41:42','2026-10-24 11:27:01',91),(4,'059f954703ba04bc7ffc957db38ca64c0901f521121fefa3430a4cd5e03d9d38','2026-10-31 11:41:42','2026-10-24 11:56:13','2026-10-24 11:41:42',92),(4,'c320faec62bd5a39b3cc7b961941dd680d97341b21c71e41dba334482b44d826','2026-10-31 11:56:13','2026-10-24 12:10:44','2026-10-24 11:56:13',93),(4,'7e6c37a550c6d435de80a24d8f9cd3ed5ff582218616bc6f9d5c04c8f7c5e724','2026-10-31 12:10:44','2026-10-24 12:25:14','2026-10-24 12:10:44',94),(4,'da368b45bf641f30ed946c84313c86a586d07bac469ad207bed21348f102d470','2026-10-31 12:25:14','2026-10-24 12:39:45','2026-10-24 12:25:14',95),(4,'c92e023c7b6f8bd4f493b1860005f90599e500182dc49ec0a320a3e46f9ee652','2026-10-31 12:39:45','2026-10-24 12:54:34','2026-10-24 12:39:45',96),(4,'7a6e7bd46a40afd2edfdbe857766b627564df740c7e0b10873f0d129605e3d12','2026-10-31 12:54:34','2026-10-24 13:09:04','2026-10-24 12:54:34',97),(4,'e472368c9c20f65b3590e7b16cde8cc900d10ad9617fa00551f7ae06f233730a','2026-10-31 13:09:04','2026-10-24 13:23:40','2026-10-24 13:09:04',98),(4,'af14e0f932db895f485899b56ca744cf53a45bbe0a2611d33778c325e8556b8f','2026-10-31 13:23:40',NULL,'2026-10-24 13:23:40',99),(4,'423a35342063a42c603da286243628249368feb278cafe1be89cabf0d2ffe715','2026-10-31 13:26:00','2026-10-24 13:38:10','2026-10-24 13:26:00',100),(4,'d13919fc645692c40a313d7f9c5f73ebd374d364a8e14f0ab3b429f40c18b4cc','2026-10-31 13:38:10',NULL,'2026-10-24 13:38:10',101),(4,'85f7862084471d7fe36d8f14a8ed3762c25b011bf765b58ef506d942d1867236','2026-10-31 13:39:26','2026-10-24 13:53:56','2026-10-24 13:39:26',102),(4,'1dd275b22252c8370a45b8ff793d358e4cbd4509fdd0baaaf952ad5d9b0923a2','2026-10-31 13:53:56','2026-10-24 14:10:06','2026-10-24 13:53:56',103),(4,'161de2b0bc0898099fcca3fb02e69a26163f7508fb39efde516854346bc65bc1','2026-10-31 14:10:06',NULL,'2026-10-24 14:10:06',104),(4,'7b7e5e340a5d99b0cf2fe1e6351568f296f04c784eac20f8d0ab8726af447edb','2026-11-02 02:20:14','2026-10-26 02:23:46','2026-10-26 02:20:14',105),(4,'20850512d38fe1fe63b4151d8b20d8bab52219a9966da4d9dd66109ecd2c093e','2026-11-02 02:25:39','2026-10-26 02:40:09','2026-10-26 02:25:39',106),(4,'4f1591221dbabc222952fda596323cecf8579ef78c594cd273c3d0859c6d0e9f','2026-11-02 02:40:09','2026-10-26 02:54:39','2026-10-26 02:40:09',107),(4,'190de5d58d1deeddcab8b9a2ff2a9ed5106dfa3388c479d211484c160f514f9d','2026-11-02 02:54:39','2026-10-26 03:09:09','2026-10-26 02:54:39',108),(4,'08333786ba5190a1b277a6c42df067680a599fb3baa4c646fbcd239512b5a0a5','2026-11-02 03:09:09','2026-10-26 03:23:39','2026-10-26 03:09:09',109),(4,'bd8c5fa4aa8750c1579aef868a08f5ee36ebbeb19e5c578e4ebaa625aeb6217c','2026-11-02 03:23:39','2026-10-26 06:49:26','2026-10-26 03:23:39',110),(4,'77722e55c70552b03a08dfc6afc86bf118621e19f15af027872b790965d4a889','2026-11-02 06:49:26','2026-10-26 07:03:59','2026-10-26 06:49:26',111),(4,'1bd184c37f26f5dae1a929b6b1ec8a2e80efb87c765cfa591a0cae64c8c1b487','2026-11-02 07:03:59','2026-10-26 07:18:31','2026-10-26 07:03:59',112),(4,'488f31ae584e95818668eeb015c970c598c53f5976bec664b2563c88c31a1717','2026-11-02 07:18:31','2026-10-26 07:33:02','2026-10-26 07:18:31',113),(4,'ab02145548330bd47146a6b3a33d3632824c07e6f1761bc7fbfd034f60a475dd','2026-11-02 07:33:02','2026-10-26 07:47:33','2026-10-26 07:33:02',114),(4,'9c79bf02be7663eaeecedeb1c5a685594c97eb297c6fe28fcba0af5d1995a2c8','2026-11-02 07:47:33','2026-10-26 08:02:04','2026-10-26 07:47:33',115),(4,'00cb3d2e03d804239f22c23083d187ad5b08ff92f00d78e9e8ee5c2a5aa7f772','2026-11-02 08:02:04','2026-10-26 08:16:35','2026-10-26 08:02:04',116),(4,'4b9454d41aa2ed16fae35eef64e2ef0494bc20c2f7c722a3a3c56d54dd8c5cc6','2026-11-02 08:16:35','2026-10-26 08:31:06','2026-10-26 08:16:35',117),(4,'ec8008d96c9289aaab1821e6214e19b913c104d33769960ded472686c4384e84','2026-11-02 08:31:06','2026-10-26 08:45:37','2026-10-26 08:31:06',118),(4,'093c3bc50b3f60fc299d7b0a1d11d8ea42f620d591ddc8c342ed20ab0850cb35','2026-11-02 08:45:37','2026-10-26 09:00:07','2026-10-26 08:45:37',119),(4,'a0d1fe2e7f70f64592fb3cca990c032dbad346e5de0337c1f5590227652a304c','2026-11-02 09:00:07','2026-10-26 09:14:39','2026-10-26 09:00:08',120),(4,'09f3862a6541777e76e9e506a8f9f5b2cdac5fed883fb148d20d2521a3363e86','2026-11-02 09:06:25','2026-10-26 09:06:50','2026-10-26 09:06:25',121),(3,'3c4c39ec27ee803b547c67bb7221f59980136f9edee19ce816cc327dc5d950d1','2026-11-02 09:07:51','2026-10-26 09:22:20','2026-10-26 09:07:51',122),(4,'ae09e98fea42c170e7b45188813a5495acb5638018ea6a03d2f687081a82dc8d','2026-11-02 09:14:39','2026-10-26 09:29:10','2026-10-26 09:14:39',123),(3,'ad64f060ea23d319f8898d94e36a074766cccad1784ef0e87d68334520f56895','2026-11-02 09:22:20',NULL,'2026-10-26 09:22:20',124),(4,'fdb3472682fc9a2accb023dc512363c4ab41802e55710567c199d3598f623b03','2026-11-02 09:29:10','2026-10-26 15:11:03','2026-10-26 09:29:10',125),(4,'d72c8757269217d0c208de8bdea0c41c238332885de0fd8e6059bb9e71db3fe6','2026-11-02 09:40:24','2026-10-27 02:25:25','2026-10-26 09:40:24',126),(4,'7dc1a83faf06c4234c0c824df3b8f0c20701d44da116c610f15b36e298c38cfd','2026-11-02 14:45:24','2026-10-26 14:59:29','2026-10-26 14:45:24',127),(4,'7faccbde5e55a06f71cfe3264e53080c61f30c3945c746c0a1d6645dfa1df805','2026-11-02 14:59:29','2026-10-26 15:13:33','2026-10-26 14:59:29',128),(4,'b643464e26691aafb69d4e22eae1cea7b5e9645dd1540bd79c40b35d5d75ae72','2026-11-02 15:11:03','2026-10-26 15:25:04','2026-10-26 15:11:03',129),(4,'810413eb74bf32758ab8f0136f3cf732ad4d46f382f1c872886b10030fb77aaf','2026-11-02 15:13:33','2026-10-26 15:27:40','2026-10-26 15:13:34',130),(4,'895eba3176311f508f39f757147d0c8e16671c3b8c1df0f9202c091048a2a121','2026-11-02 15:25:04','2026-10-26 15:39:06','2026-10-26 15:25:04',131),(4,'f5937df88b2de9d7037a695be2c46f960d033f4aa716e6dadae8b41cc34c7d80','2026-11-02 15:27:40','2026-10-27 02:37:16','2026-10-26 15:27:40',132),(4,'8bde1f8082c6f6cfc3d123f5604d7391a1fddd5daa3b6dc5a2e765d6b052d680','2026-11-02 15:39:06','2026-10-26 15:57:33','2026-10-26 15:39:07',133),(4,'d344fc9677c6d9d9cf2a3a75c392ac0db5fa6c6f9b6104a2598278e8b94dd336','2026-11-02 15:57:33','2026-10-26 16:11:34','2026-10-26 15:57:33',134),(4,'c3076a975cfac2ee5739e5c967f074c4e41dfdea26af0b4aa3ba56eaadcd1a36','2026-11-02 16:11:34','2026-10-26 16:25:36','2026-10-26 16:11:34',135),(4,'48ee4bfece184d71eeca286ea2890f64630138e1fc317113e9d7215b3e848bbb','2026-11-02 16:25:36','2026-10-26 16:39:38','2026-10-26 16:25:36',136),(4,'6d10d8be636034d30b99bf01b44c3eed106b8a6ade9f4dc2b6ec505e47f121d6','2026-11-02 16:39:38','2026-10-26 16:53:40','2026-10-26 16:39:38',137),(4,'f0961da02be342c2ba347aa8c565b2a683ceecc548be8c128bf02e258eac81d2','2026-11-02 16:53:40','2026-10-26 17:07:42','2026-10-26 16:53:40',138),(4,'42565f35ca7ff745a5bbff577c5f937046ec81f8e80605410aea7ae95879d753','2026-11-02 17:07:42','2026-10-26 17:21:44','2026-10-26 17:07:43',139),(4,'e3a7945f5afc3beba5ddac675e56ed9493e38fcc2b33ac45dc7b45e84cf1bb9d','2026-11-02 17:21:44','2026-10-26 17:35:46','2026-10-26 17:21:45',140),(4,'5a048784e486db1527b2d63754ded16eba6735177d27434a42c94c9f1756b591','2026-11-02 17:35:46','2026-10-26 17:49:47','2026-10-26 17:35:46',141),(4,'a6a78e072da05df2bc804829609d708241a4e91ee4fb1a686ecdcffb30e75757','2026-11-02 17:49:47','2026-10-27 01:44:51','2026-10-26 17:49:48',142),(4,'19ee7b47e1b05d2fb15765410c702f979a6e8f463a1b325f9e5783f4ba3e32da','2026-11-03 01:44:51','2026-10-27 01:58:52','2026-10-27 01:44:51',143),(4,'bc8f6af5dee021f84d7304fccf72fbe0dbfe86fe8b6bcfce28d9d054ed1fa7f4','2026-11-03 01:58:52','2026-10-27 02:12:54','2026-10-27 01:58:52',144),(4,'c8e9ac993b2c94d246f54e64472352b3f077a030eb1fd37a30186ce2c6d3f7ca','2026-11-03 02:12:54',NULL,'2026-10-27 02:12:54',145),(4,'cd38e689e6f08eb0d754a6c5c473a16a1b3899436257ff5c2980266ad707ed9f','2026-11-03 02:25:25',NULL,'2026-10-27 02:25:25',146),(4,'7fa3cd34138711b7e130ef63cfb4af777943fc19d42ec18420e257b7c1ee1f0e','2026-11-03 02:37:16','2026-10-27 02:51:22','2026-10-27 02:37:16',147),(4,'66b99fe80c2e091e8af6d6de374fa0aa77961acbe25d33b83a12b949b9717901','2026-11-03 02:51:22','2026-10-27 03:05:28','2026-10-27 02:51:23',148),(4,'91cf0086800e93c400729045c8d20b560a3bf5b6f25e8459056427b59b78829c','2026-11-03 03:05:28','2026-10-27 03:19:36','2026-10-27 03:05:29',149),(4,'dd2b04cef89990ab77739e1f4b075ec464fe987430424e4ed9f06ecd7e2d2423','2026-11-03 03:18:37','2026-10-27 07:04:28','2026-10-27 03:18:37',150),(4,'a1ca3d103f16347a18077a52ebd2690c4fab39afa3bdf1cf17bd69aa0ccf4e51','2026-11-03 03:19:36','2026-10-27 03:33:42','2026-10-27 03:19:36',151),(4,'53133066564f01699c81e308d724aae9bb8cb1bcbebe6315c912549484162e04','2026-11-03 03:33:42','2026-10-27 03:47:48','2026-10-27 03:33:43',152),(4,'c5073177daae35dcfed12a8544414a81af621a2aed331f925d7769bd6c9d30b1','2026-11-03 03:47:48','2026-10-27 04:01:54','2026-10-27 03:47:49',153),(4,'3e0eed166616ed3056d70b1c3ddb633fac224d257e2f9512fe7ae9ff7ee84b57','2026-11-03 04:01:54','2026-10-27 04:15:59','2026-10-27 04:01:54',154),(4,'dc497f87c7afe2824ffec565acbc8c163e206061dfb690d8f54a74aa20c9ac1b','2026-11-03 04:15:59','2026-10-27 04:30:04','2026-10-27 04:15:59',155),(4,'c20cc38a2ebf4e7712669bce7eb2292227d1cf1cc0cf85fff6c7c87b02325cab','2026-11-03 04:30:04','2026-10-27 04:44:10','2026-10-27 04:30:04',156),(4,'a7867e4074d5173bf0395ad5010b3cb23adced61e6b08757a6e2ef8c3e2708c2','2026-11-03 04:44:10','2026-10-27 04:58:15','2026-10-27 04:44:10',157),(4,'784d5bf734346056765b119471e167ff7efa5cdee712c2acec8c87113eb5dec6','2026-11-03 04:58:15','2026-10-27 05:12:20','2026-10-27 04:58:15',158),(4,'37ea62c80cd25e9c5ba3961cd1bade08e99c0671ebeafd649ca5987fb6a78688','2026-11-03 05:12:20','2026-10-27 05:26:25','2026-10-27 05:12:20',159),(4,'57ade57ce26d7f29a3162f298a4f6a50e036b96cd9b9838a306633ff75d4ad4a','2026-11-03 05:26:25','2026-10-27 07:21:58','2026-10-27 05:26:25',160),(4,'fcab9a888be8bd3466eda3c5f3bdfbf0c9835c9d6944c0e3a97ece1e99bb800d','2026-11-03 07:04:28','2026-10-27 07:18:29','2026-10-27 07:04:29',161),(4,'513447c389594c4f1e9a5e1106f9ad2afafbc07e5f1547833582dfa19f0ffd5a','2026-11-03 07:18:29','2026-10-27 07:32:32','2026-10-27 07:18:30',162),(4,'3ac721e2b0da8b71a1b15c1d34a7f73de468dd9096b337557ebeceace3f97e78','2026-11-03 07:21:58','2026-10-27 07:36:04','2026-10-27 07:21:58',163),(4,'4e5d5044256fcb8777d3e4c61cdca03e76ec5b13e7340994af2529c4f26d4192','2026-11-03 07:32:32','2026-10-27 07:46:33','2026-10-27 07:32:32',164),(4,'d1d3fcd0ae9f19f066161e17a2e11e5d5479e01c6dae3882bdbe313b7adf8c4c','2026-11-03 07:36:04','2026-10-27 07:50:10','2026-10-27 07:36:04',165),(4,'42500f5b2f0498547c281180f0052a4d3efafd0bebe1f0c36687c292e1a21646','2026-11-03 07:46:33','2026-10-27 08:39:33','2026-10-27 07:46:34',166),(4,'3fee5545612501599ddb7faa402c3517f0bf2bee870a65d4b84e5c0bed37084e','2026-11-03 07:50:10','2026-10-27 08:04:16','2026-10-27 07:50:10',167),(4,'5fd69e202cf1de395210008bcc50c1fa46a735b8baed36f5f2e7ba5b3c19ca20','2026-11-03 08:04:16','2026-10-27 08:18:22','2026-10-27 08:04:16',168),(4,'c36e490a6bfc539b9fd10c2122c7faed585055d1fcabffed7b99dd1afa4be958','2026-11-03 08:18:22','2026-10-27 08:32:28','2026-10-27 08:18:22',169),(4,'8eece1ab7367b3995b39579a72f6533c4f752ce90993020935b5a3dd0daa70c0','2026-11-03 08:32:28','2026-10-27 08:46:34','2026-10-27 08:32:28',170),(4,'1ab44ea4994a98f26cb4a9f83f5271285e20686f81d917122a2dbac6b028cb80','2026-11-03 08:39:33','2026-10-27 08:53:37','2026-10-27 08:39:33',171),(4,'8d6ab55abeab02064c16bcd100f80acbfd72422d661715e97c6b4560be3d2c9e','2026-11-03 08:46:34','2026-10-27 09:00:40','2026-10-27 08:46:34',172),(4,'4d3e75da6b6e54791309798e31b070f9b26c3b06b950441c662b04544cdc25f4','2026-11-03 08:53:37','2026-10-27 09:07:39','2026-10-27 08:53:37',173),(4,'589f31081b6a7b21de7f4c3acd6a8958c1f010c1fc50c6cfe068aded70b7d529','2026-11-03 09:00:40','2026-10-27 09:14:47','2026-10-27 09:00:40',174),(4,'f9164f53d386995a26a63c5b301b4fa50deaa88ae9b424c05efec47c9b9db99f','2026-11-03 09:07:39','2026-10-27 09:21:40','2026-10-27 09:07:39',175),(4,'5f5337a15bd677f8e0ea1deef032a891130fa9d5a636d11454f8724a94e41468','2026-11-03 09:14:47','2026-10-27 09:28:53','2026-10-27 09:14:47',176),(4,'891bcfacaef9b3f3361b4891788fb5830cff42c956e919dd069c6e25ac98aaf5','2026-11-03 09:21:40','2026-10-27 09:35:41','2026-10-27 09:21:40',177),(4,'faabd243d2fff023a0d5d6f608488bd3d90fd861126155e568797986c1130716','2026-11-03 09:28:53','2026-10-27 09:42:59','2026-10-27 09:28:53',178),(4,'c47669dcaa71b4029be4fa656ff7b3b97937ca8570290c70949e67bea4f70a1b','2026-11-03 09:35:41','2026-10-27 12:04:13','2026-10-27 09:35:41',179),(4,'9965a97d1874d97a5d5daf3a1477bf5aeb9d5f5211726c50fc3779bfad5b14b6','2026-11-03 09:42:59','2026-10-27 09:57:05','2026-10-27 09:42:59',180),(4,'9f01c13fb86cae3538aeba6f150aa0710adbad0fefa3a31d5ae5af19fa747dee','2026-11-03 09:57:05','2026-10-27 10:11:11','2026-10-27 09:57:05',181),(4,'0c567866f33bcf79e7835ca952f39c246ccf011c0bee5614409f09c0f9b7a74d','2026-11-03 10:11:11','2026-10-27 10:25:17','2026-10-27 10:11:11',182),(4,'7a519561f1af04c9daefd37d85185ed92794ea6d45ae7e3e21ca3137220ced86','2026-11-03 10:25:17','2026-10-27 13:54:49','2026-10-27 10:25:17',183),(4,'fce0de0b4434b87acebb76ccf25edc2fe4b6ad491e5d509b645d80c1b9aadea2','2026-11-03 12:04:13','2026-10-27 12:18:15','2026-10-27 12:04:13',184),(4,'8e92b097fe4fd65ff9befd1ff34a7e5c05f64d9888718ff91f4949ea5567d3f0','2026-11-03 12:18:15','2026-10-27 12:32:16','2026-10-27 12:18:15',185),(4,'13b31d28d2d508f955327c77a668f175fa8a3a3c67a72723bd05896cf1f083cb','2026-11-03 12:32:16','2026-10-27 12:46:19','2026-10-27 12:32:17',186),(4,'512039445dde95e16f272aab16bcb137f7744eb6a0236075b48bc6a8b2c0a9f6','2026-11-03 12:34:43',NULL,'2026-10-27 12:34:43',187),(4,'b8400f41bf6aeb996d7f35ac6a234ea5811e879c273c768fd0b9bc3ce217326a','2026-11-03 12:46:19','2026-10-27 13:00:20','2026-10-27 12:46:19',188),(4,'773de491d06b270f8c214fae6db8150f0fc132b1c15320730f3003585bc4f284','2026-11-03 13:00:20','2026-10-27 13:14:23','2026-10-27 13:00:21',189),(4,'0e618a8aec1be4ea8bae06986c2d05641c88f2a27361ab7b66d34312831b728c','2026-11-03 13:14:23','2026-10-27 13:28:25','2026-10-27 13:14:23',190),(4,'fce6c508793ac6dcf3eedfd22e7a787eb445cd1767238cc79c461653f4d7dbfb','2026-11-03 13:28:25','2026-10-27 13:42:27','2026-10-27 13:28:25',191),(4,'d588773e087b29375e28c9c4be5f329bee69dbeca9e67517eff079218a1b11fe','2026-11-03 13:42:27','2026-10-27 13:56:29','2026-10-27 13:42:27',192),(4,'f8b019ba95dbb57297dd7c105a0e77a8d75d172d8b40727a7370f5f259c332e3','2026-11-03 13:54:49','2026-10-27 14:06:00','2026-10-27 13:54:49',193),(4,'fc400f4b68e3545e99cdfaa5750e2a5ccc2c841b8ed069682d5198e7c66da66f','2026-11-03 13:56:29','2026-10-27 14:10:31','2026-10-27 13:56:29',194),(4,'ed1a8cd3b2c2993d2e5ad69bbeba3c6b14c4fdde3be73834caa8bb5076103fee','2026-11-03 14:08:13','2026-10-27 14:22:17','2026-10-27 14:08:13',195),(4,'e7ee802bf1f045daedbf9a945b48004d4f6e3a7c19023c5df5d9ed9e12f34602','2026-11-03 14:10:31','2026-10-27 14:24:33','2026-10-27 14:10:31',196),(8,'8e4f392cfff5988903da65e15f852b94c451ffc1a4d0169025ca89567819c2e1','2026-11-03 14:12:25','2026-10-27 14:26:30','2026-10-27 14:12:25',197),(4,'bee46389d44e01a598a9f92aa94bf888651bc194cd4f6a0f1bbbe236a3cee6c6','2026-11-03 14:22:17','2026-10-27 14:36:23','2026-10-27 14:22:17',198),(4,'1b2d3147ae8b0446fef161e02a87ab6f2468d38b71ae915217be039d60ae3ac0','2026-11-03 14:24:33','2026-10-27 14:38:35','2026-10-27 14:24:33',199),(8,'f07edd4ce7fcf2a106540c4abc75e5b4fbc6b998f15e91e964ec5ac31b7ed6f4','2026-11-03 14:26:30','2026-10-27 14:40:38','2026-10-27 14:26:30',200),(4,'fc1510d42bea18209ca68e7f4693222aa98f5b0980cb0d199666d913c93e7d02','2026-11-03 14:36:23','2026-10-27 14:52:12','2026-10-27 14:36:24',201),(4,'38d05ed2ca44ca306fff6169b57ca6a7d82507bc0e544ab79e126af9e3826bfe','2026-11-03 14:38:35','2026-10-27 14:52:37','2026-10-27 14:38:35',202),(8,'36d45bb7b04d45e60167a529df17a7e884efa085b825a0ebf97b04fe844367d5','2026-11-03 14:40:38','2026-10-27 14:54:47','2026-10-27 14:40:38',203),(4,'6eb4c82a4c99f39ec53e7ed356b432204e182216730df5c4831e1fdfb192b338','2026-11-03 14:52:12','2026-10-27 15:06:18','2026-10-27 14:52:12',204),(4,'64057c896189f3d3cf7e87453c3d708cf718102a828c2572ea08b5b5d6b5da5d','2026-11-03 14:52:37','2026-10-27 15:06:39','2026-10-27 14:52:37',205),(8,'0954cd0f12b6afcc270aa51707a2fb07f2f4699f7909637649da7dc861cb2937','2026-11-03 14:54:47','2026-10-27 15:08:52','2026-10-27 14:54:47',206),(4,'8de07cf94bae510386eb9a5698d131b7224ceaaf2984222cea3f7f78f3424ec1','2026-11-03 15:06:18','2026-10-27 15:20:50','2026-10-27 15:06:18',207),(4,'1eec1e44ee8f978c31b44d4a583716d015f1e123ef78ac13f8e6e0092b28af2c','2026-11-03 15:06:39','2026-10-27 15:20:41','2026-10-27 15:06:39',208),(8,'b2fc60e624097a0bc9892434fa24aa5fc11ae71dc174637a44b73acbb10f614a','2026-11-03 15:08:52','2026-10-27 15:23:01','2026-10-27 15:08:53',209),(4,'8a9f28b793835ef3722341ac7fe433f78d61020ab64b43f3f4592e56fcd96615','2026-11-03 15:20:41','2026-10-27 15:34:43','2026-10-27 15:20:41',210),(4,'df58e812c75fd3709902697b8ff81860bbb1c0cf11d86494a32dfd55ce554ca4','2026-11-03 15:20:50','2026-10-27 15:34:56','2026-10-27 15:20:51',211),(8,'d0ad92779eefc8168633c4aacc9c3c686eb24270f63e1b698e52f90c8cdab8dd','2026-11-03 15:23:01','2026-10-27 15:37:07','2026-10-27 15:23:01',212),(4,'432000e411a03b6258ca534b6dfef7ad5c32172021e85fe95f51532c48e7a4f7','2026-11-03 15:34:43','2026-10-27 15:48:45','2026-10-27 15:34:43',213),(4,'0d02fff862b7c2c5a71fb4ec97c0a5a728b73e0bba92ef510d94fd0c8f2f5328','2026-11-03 15:34:56','2026-10-27 15:49:03','2026-10-27 15:34:57',214),(8,'e75f412628c8f13df5865b9b81514009ad98a7a932a13307e32be2514599210b','2026-11-03 15:37:07','2026-10-27 15:51:14','2026-10-27 15:37:07',215),(4,'d43d32a5c083e9e0d7f2d9a29011127d73b8898307b08bf994a0d7c8052317b6','2026-11-03 15:48:45','2026-10-27 16:02:47','2026-10-27 15:48:45',216),(4,'00994fd472eeacbfbf98fd0355c4bc48eca0b89898b3f78841d55add7a09bb15','2026-11-03 15:49:03','2026-10-27 16:03:08','2026-10-27 15:49:03',217),(8,'aaa1786aad8332168d2ca1f509eef709003775de38407f4b84fafb5434c2ddf4','2026-11-03 15:51:14','2026-10-27 16:05:22','2026-10-27 15:51:14',218),(4,'561770c14c38868585c10fce4a0d2d482f37827ec52d659b39d77c72de6bd8fc','2026-11-03 16:02:47','2026-10-27 16:16:49','2026-10-27 16:02:47',219),(4,'d3369b08eb2180b23dba1cc800f660dc50a80c4e6109bcaa6984838e07e33aa6','2026-11-03 16:03:08','2026-10-28 03:44:07','2026-10-27 16:03:09',220),(8,'948ef76f9e6f0a1c08708cf3ff38ed4662851f98e11821a04ff467cd8d984ceb','2026-11-03 16:05:22',NULL,'2026-10-27 16:05:22',221),(4,'6a6de48885695607e2840fd148ca98e1b430c5a21259f67edd1b717ef5aae771','2026-11-03 16:16:49','2026-10-27 16:30:51','2026-10-27 16:16:49',222),(4,'f7bea4840e0fae5283a8addb900fef482f5b57cc064bc76caa2f051897253880','2026-11-03 16:30:51','2026-10-28 02:37:16','2026-10-27 16:30:51',223),(4,'6441af47e82faa16a12ef030f3635cb1faa003ed624d43b92f40e58db0e91475','2026-11-04 02:37:16','2026-10-28 02:51:18','2026-10-28 02:37:17',224),(4,'1bafcda9f1bc5105c35a9c5ab251577e9d60f54efa30ed7c498dda39bc41c4ed','2026-11-04 02:51:18','2026-10-28 03:05:21','2026-10-28 02:51:19',225),(4,'7e7b5804e57982eb96b26913b4306d3a1376d6a830873a899a37c536f28a01b5','2026-11-04 03:05:21','2026-10-28 03:19:22','2026-10-28 03:05:21',226),(4,'c6a74e3111a9a1e06d0f241e60d6a168ff73525aad3155717d6acfabe904cd0b','2026-11-04 03:19:22','2026-10-28 03:33:24','2026-10-28 03:19:23',227),(4,'f30346c14673051dc30a9af93fde86f4255ad094a25007aced49562535a4e3af','2026-11-04 03:33:24','2026-10-28 03:47:26','2026-10-28 03:33:25',228),(4,'03bfec21ca91746db1905a36c19dde453f3d91d3c24e154320a78050dd3167bf','2026-11-04 03:44:07','2026-10-28 03:58:15','2026-10-28 03:44:07',229),(4,'b9d57f66385493568f43acf27cfd4a0ff82d8d79e99b24f5fab43763c531d2b3','2026-11-04 03:47:26','2026-10-28 04:04:16','2026-10-28 03:47:27',230),(4,'116cf07c873aa4f3d1d48b1484bd6996142ae52e704adb8ebf8b5f98c891ba89','2026-11-04 03:58:15','2026-10-28 13:59:19','2026-10-28 03:58:16',231),(4,'8985a9388e523b80cf2ef753b3b03ff21190e53968dca00d7c6b2b92c1be0dd3','2026-11-04 04:04:16','2026-10-28 04:18:18','2026-10-28 04:04:16',232),(4,'b7430f132d929f19efa0a28667902651c0022bd2ded7e6de36e6009b1fd04f10','2026-11-04 04:18:18',NULL,'2026-10-28 04:18:18',233),(4,'50c490f0aad6747b1e250b332ea40452316006d7918ce0568fc344e4b2d247a8','2026-11-04 04:18:47','2026-10-28 04:39:54','2026-10-28 04:18:47',234),(4,'56a4193008f9b72375766a9ec76b4e6fb8be38a08fd3037d7fb61f41e4e643ef','2026-11-04 04:39:54','2026-10-28 04:53:56','2026-10-28 04:39:54',235),(4,'a344078a4ac39463729e2691fb204dddecf78b1b37dcf232c5107e16685406a5','2026-11-04 04:53:56','2026-10-28 05:07:57','2026-10-28 04:53:56',236),(4,'4c1c6eb115c9ae8cf2f319e12c2b275cb5d8b7ee8dc4784aada57ada1244b633','2026-11-04 05:07:57','2026-10-28 05:22:03','2026-10-28 05:07:58',237),(4,'91ea9cd40063f5b9de18add5375baaf17cbbb5db6abbdd65e083b8c5597dc9e4','2026-11-04 05:22:03','2026-10-28 05:36:05','2026-10-28 05:22:03',238),(4,'7d552303d41e9c676a9212739b7b55e8c493e6451a5aa80d061934a7d3aef31e','2026-11-04 05:36:05','2026-10-28 06:24:19','2026-10-28 05:36:05',239),(4,'31bf8aac6ab57790234bbfed2f7b1873c9c61e7825bd504bd91cbcd3255b6d4e','2026-11-04 06:24:19','2026-10-28 06:38:22','2026-10-28 06:24:19',240),(4,'773a8f80db9a4857373096784425abff1b10eca0611e0637d27899b5cfdde1a5','2026-11-04 06:38:22','2026-10-28 06:52:23','2026-10-28 06:38:22',241),(4,'cc0d241ecf4287b5c0d8ad68c4124a5b91400ca868de08afe883342fb8c053a6','2026-11-04 06:52:23','2026-10-28 07:06:25','2026-10-28 06:52:24',242),(4,'3ff9249ab34f1d6c4b8a6697292563d30e8b8c3a6401072ccc3d9a48ae49defe','2026-11-04 07:06:25','2026-10-28 07:20:27','2026-10-28 07:06:25',243),(4,'183c14c6fce4dd9cae11e6c17cb730ecbab3a42513be2fd0b78d8b54849fa0e2','2026-11-04 07:20:27','2026-10-28 07:34:28','2026-10-28 07:20:27',244),(4,'6e3aff9620adb7044e8592f07f5ce037d2254a4cb08480330ca75d0f49c64a49','2026-11-04 07:34:28','2026-10-28 07:48:30','2026-10-28 07:34:29',245),(4,'099f7e99d557000414ad153681540736163ab1026da82ce8fc5b9f721f09f01b','2026-11-04 07:48:30','2026-10-28 07:50:09','2026-10-28 07:48:30',246),(1,'b663705370f2f11182a5f33d9f3ecac4b0c229a3c69fffd3c4e17f9ce3c18f69','2026-11-04 07:53:07','2026-10-28 08:07:07','2026-10-28 07:53:07',247),(1,'5f12df8a1a9053805d46b73ad03d2c72e4323e9e50bc5a92ee78c284f7bebd62','2026-11-04 08:07:07','2026-10-28 08:19:09','2026-10-28 08:07:07',248),(4,'d9cf1618ec56f3e80301a454931e2cb37396e56a701fccbdfa855395d3938881','2026-11-04 08:19:15','2026-10-28 08:20:53','2026-10-28 08:19:15',249),(1,'785aec8f3633d996124a481e72cfc0d34b4555f755afc11a672a7743c0c293a5','2026-11-04 08:20:58','2026-10-28 08:34:58','2026-10-28 08:20:58',250),(1,'512907a5f1f04c1607ae2d14549afa6e48fd8315d36e1d40035d96f41db050e3','2026-11-04 08:34:58','2026-10-28 12:24:18','2026-10-28 08:34:58',251),(1,'f5d5b576dbc40b600a9fd405a8f30498e2f6e2609422ebe0e18234cd382b1924','2026-11-04 12:24:18','2026-10-28 12:38:21','2026-10-28 12:24:19',252),(1,'529505a6424100804dbd235b4199910aebad7209a8f9c5f935b72d1c5e35ba23','2026-11-04 12:38:21','2026-10-28 12:39:19','2026-10-28 12:38:21',253),(2,'3359ece224bedc14e9ccb5e1e84ae9bc0aabc6c4eadf9b3a3ec099699beb926c','2026-11-04 12:39:26','2026-10-28 12:53:34','2026-10-28 12:39:26',254),(2,'c40955137bda03579f64877305d4f1396df64a1ab24c85716c3f8baa2ce6df6a','2026-11-04 12:53:34','2026-10-28 13:07:42','2026-10-28 12:53:34',255),(2,'be28a7484d1f18a3d14a62c6494a1096037a43661c32fd6fe85dcdffa952e72e','2026-11-04 13:07:42','2026-10-28 13:21:50','2026-10-28 13:07:42',256),(2,'4161198b12a7f3c6a1a0dc580a0500a845b756e666243f2e9caa42856804fc3b','2026-11-04 13:21:50','2026-10-28 13:35:59','2026-10-28 13:21:51',257),(2,'be78a324b2f3c4fb5ce668ab700e61ad865b506c3f6bfaa840a8abdb4b6b37bf','2026-11-04 13:35:59','2026-10-28 13:50:01','2026-10-28 13:35:59',258),(2,'457f5217c2ffbe459d273d85d93edc1e636985321d6eeaf95706059c8ef42767','2026-11-04 13:50:01','2026-10-28 14:04:04','2026-10-28 13:50:02',259),(4,'cfe19f1c722fa923e6531aa9f02ded8241dda11d16129af8011ab41a00c795ab','2026-11-04 13:59:19','2026-10-29 04:12:02','2026-10-28 13:59:19',260),(2,'14df0c6825c30eb18e1819744e579abcc7e42f36c9ea572a6af232c980d4415e','2026-11-04 14:04:04','2026-10-28 14:18:13','2026-10-28 14:04:05',261),(2,'74e7dca6034e02b8123496116183889ada7116db56d3d77e12903d12977f090b','2026-11-04 14:18:13','2026-10-28 14:30:25','2026-10-28 14:18:13',262),(1,'e65eb8c72502eeb45ff65355eb5bba1ca54fdbae17dad4aed71e937c01e15673','2026-11-04 14:30:31','2026-10-28 14:30:45','2026-10-28 14:30:31',263),(1,'9bfa29fced07fc8f65b796469ad091846ab1a050c2c4fb2594e6b4fce67b381f','2026-11-04 14:30:51','2026-10-28 14:44:59','2026-10-28 14:30:51',264),(1,'195b461a1a715b613de7a20e05a8838d41c5793deb9b2a127df4c43096d60294','2026-11-04 14:44:59','2026-10-28 14:59:08','2026-10-28 14:45:00',265),(1,'a20f7536dd0c623a1019dfd7f5f41a1b16af04e8d611a2af755911724519568d','2026-11-04 14:59:08','2026-10-31 01:37:03','2026-10-28 14:59:08',266),(4,'bf2704a41f0b8b143ddc7780ec380cbf9c4dd3615b864ee44e32e5dc8dd55337','2026-11-05 04:12:02','2026-10-31 01:54:42','2026-10-29 04:12:03',267),(1,'0b9aa438871e09b65ed7ae992ed4ff838a4b5429dcc0369c0b56d9a2a118743a','2026-11-07 01:37:03','2026-10-31 01:51:15','2026-10-31 01:37:03',268),(1,'28cfc1dfd526722ed296148d0325993abd4c72fc32ef63c7e6c5ca59b97bfdf4','2026-11-07 01:51:15','2026-10-31 02:05:17','2026-10-31 01:51:16',269),(4,'c85ec62da9fe07476944b8e7ae9f8578ee9ebd51ac9bfbcba561dbeb864633fd','2026-11-07 01:54:42','2026-10-31 02:18:19','2026-10-31 01:54:42',270),(1,'3f5ddfbc18d33744908c59906f146a7518974c12d544f8e17ea0bd1ee9365e68','2026-11-07 02:05:17','2026-10-31 02:19:18','2026-10-31 02:05:17',271),(4,'9c20601a86165c0d550274516a8cf4740268234ddfcf8646943c11cc6318650c','2026-11-07 02:18:19','2026-10-31 02:32:23','2026-10-31 02:18:19',272),(1,'752f4b5b3b06af188c3974c4a4ba93714ce444c482b8dd61cd3741dc507a19ac','2026-11-07 02:19:18','2026-10-31 02:33:20','2026-10-31 02:19:18',273),(8,'0cff813e69f74f2710a79692a10565dafb26b4bfe0b5c7fa4e018a955c070591','2026-11-07 02:31:39','2026-10-31 02:45:42','2026-10-31 02:31:39',274),(4,'e95bc473a46e0a73871be81fa1b5dd98f71bb401662554d4da053c43d167b32f','2026-11-07 02:32:23','2026-10-31 02:46:29','2026-10-31 02:32:24',275),(1,'6e38d69bcd0e0f79a2b67dd543f08cacc8b0e42c6c6812ad1465d6eac04a35bb','2026-11-07 02:33:20','2026-10-31 02:47:21','2026-10-31 02:33:20',276),(8,'872c17f3d96306de0301a1736c6ef999fc6754e56ad233ed3a184adefef8d31d','2026-11-07 02:45:42','2026-10-31 02:59:47','2026-10-31 02:45:43',277),(4,'25c11bac69886a207b186e6a680c0d2759517daeba0e9080fc9f7c0639c457ff','2026-11-07 02:46:29','2026-10-31 03:00:33','2026-10-31 02:46:29',278),(1,'c19d557420c61ec9fb9993988e6f44dcbbede4c4d36dd02eabe05533dc9b8c02','2026-11-07 02:47:21','2026-10-31 03:01:22','2026-10-31 02:47:21',279),(8,'64004c75128f2db032bfad8f16654d11e5cfb041f227b16edf086babf6c11eaf','2026-11-07 02:51:14','2026-10-31 06:03:13','2026-10-31 02:51:14',280),(8,'6e64f3c765cfeb51ecd9e3cba3e30a9db9dfe9dc526483371af70bffee12d860','2026-11-07 02:59:47',NULL,'2026-10-31 02:59:47',281),(4,'174de493d59ba8f63a000d4fb5aecd052d7446fe345348ec2c7218065e325eeb','2026-11-07 03:00:33','2026-11-01 07:54:08','2026-10-31 03:00:33',282),(1,'0413e02a12d25f52ef4d6bcdcc41fbea10b5e84b57696efaa46acc7c819bc3e4','2026-11-07 03:01:22','2026-11-01 07:56:09','2026-10-31 03:01:22',283),(8,'da1aa451792dc22a634711520ee0be8088d17ef1cf8950578fc22657698436d6','2026-11-07 06:03:13','2026-11-02 10:58:42','2026-10-31 06:03:13',284),(4,'9fad42bef065459aa84d156c74b025f665c2f5d0c6a65d8d7ccf7f9c59334168','2026-11-08 07:54:08','2026-11-01 08:08:10','2026-11-01 07:54:09',285),(1,'957d2625c35053c8c1f688ef803976ef4d993528b411fc8f997764eb0827efed','2026-11-08 07:56:09','2026-11-01 07:56:13','2026-11-01 07:56:09',286),(4,'b5268f79d99c42b77a7a91c68bf3a679d320c9d0c834961163d87e5492942cfa','2026-11-08 07:56:19','2026-11-02 07:51:36','2026-11-01 07:56:19',287),(4,'93b5948248a00f083a8c07ecc903e0e434b8973b43661c19e29532734eb4871c','2026-11-08 08:08:10','2026-11-01 08:22:12','2026-11-01 08:08:11',288),(4,'f0c0b3536680c75d30e1d3de0ae409d2c767263b97304c04471dc99826ce1a76','2026-11-08 08:22:12','2026-11-01 08:36:14','2026-11-01 08:22:13',289),(4,'016a98854e56ce65d9d050b0d041b68e9fe4d6e804ee359d849bd845d8e15dc2','2026-11-08 08:36:14','2026-11-01 08:50:16','2026-11-01 08:36:15',290),(4,'135e33ee8235dab86314352c50dc787869afd1fc7291ca983f8131cbeacecb33','2026-11-08 08:50:16','2026-11-01 09:04:18','2026-11-01 08:50:16',291),(4,'a0ffc02ea755e8ac00eacbde7f3f2af66bc83c9e422676ae7da48bfc26688ef1','2026-11-08 09:04:18','2026-11-01 09:18:20','2026-11-01 09:04:18',292),(4,'7818136ca570359e8d85590000b264ee1a6f4aa1a6739dd15356de48cc96c96a','2026-11-08 09:18:20','2026-11-01 09:32:22','2026-11-01 09:18:20',293),(4,'20e62d332b15713e338ac2dc1f476a1d0d52e99ade32b7c059888ff8eb277f9e','2026-11-08 09:32:22','2026-11-01 09:46:24','2026-11-01 09:32:22',294),(4,'06de6af72d2be9a35a5847cd71f8e27120374d6f4723bb9f8d2c06d82732473f','2026-11-08 09:46:24','2026-11-01 10:00:26','2026-11-01 09:46:24',295),(4,'bcec34de4955b6f1ac8b5844274f97ead37c718350bbd5090bc616e9c7d2f76b','2026-11-08 10:00:26','2026-11-01 13:00:06','2026-11-01 10:00:26',296),(4,'31e41fb6491199bed17d6054189a9f1c55e8013fddbab6048cab67c7db895a35','2026-11-08 13:00:06','2026-11-01 13:14:07','2026-11-01 13:00:07',297),(4,'ace97910df2419ea63f608b3ca718cee3199a387a18d8137c794030b493f47f3','2026-11-08 13:14:07','2026-11-01 13:28:07','2026-11-01 13:14:07',298),(4,'d6629832c5ca22f6d6950ae8c3f42ca22c571e8fe13a2dd186e55792ab398e7c','2026-11-08 13:28:07','2026-11-01 13:42:07','2026-11-01 13:28:07',299),(4,'79bbfb9ba8a725ce4e6c0bd75f82bc0ed17f58f5f8d6deda20f4f29ea18835a1','2026-11-08 13:42:07','2026-11-01 13:56:07','2026-11-01 13:42:07',300),(4,'5c6014b1c6366564a5e0febb3a7a80178e4a2c57200283be53351cf1d3aa88da','2026-11-08 13:56:07','2026-11-01 14:10:09','2026-11-01 13:56:07',301),(4,'b1c191cb8957561ecea7ebf0e573eabdbbd4ea9a078828545bb0ff94ccf9732d','2026-11-08 14:10:09','2026-11-01 14:31:44','2026-11-01 14:10:10',302),(4,'6eec0db87b77f989d95b8e2b3f984d2eedccb16834c5409a85b10cbb3c1f151d','2026-11-08 14:31:44','2026-11-04 13:50:38','2026-11-01 14:31:45',303),(4,'6e22eb296254e329a03f9c801c6e0d83be8e63b93d606f53c9f315e990e2478a','2026-11-09 07:51:36','2026-11-02 08:05:38','2026-11-02 07:51:37',304),(4,'cfc69762c34860659f90450ed2d2a98c8a11749395e0548d5c4e8eaee52f374f','2026-11-09 08:05:38','2026-11-02 08:19:40','2026-11-02 08:05:38',305),(4,'a033b0a8e10556d8f680ac7964fa4caccecf18334eac764a5aa139bb4d9e18d0','2026-11-09 08:19:40','2026-11-02 08:33:41','2026-11-02 08:19:40',306),(4,'e437c33629c1507eb4f758cb92d38faa66402eed233f1ba35b020e2213f29bc1','2026-11-09 08:33:41','2026-11-02 09:02:20','2026-11-02 08:33:41',307),(4,'dc7500574fce94fb0189edc7962ca37fbb5557aa684601013e37370ad0828a84','2026-11-09 09:02:20','2026-11-03 03:24:05','2026-11-02 09:02:21',308),(8,'c9f997b0a08e1efc536a74d8c7de675fb5ccdcd347a80fe4367361b786944383','2026-11-09 10:58:42','2026-11-02 14:24:32','2026-11-02 10:58:42',309),(8,'f916f66c85d991f514a16246a88ba39a3a2cad2c3cdc6374e9ae01bb79427619','2026-11-09 14:24:32',NULL,'2026-11-02 14:24:33',310),(4,'80a205ecc48c4aa582a55ada6ab5bf6f134bd71fc271f2d13a8c59dc3273afca','2026-11-09 14:25:01','2026-11-02 15:35:01','2026-11-02 14:25:01',311),(4,'b5fae6f37d6b6a1eb49c432fb60b2170fd3c20bc189083a3794e75a71e2ef11d','2026-11-09 15:35:01','2026-11-02 16:10:20','2026-11-02 15:35:02',312),(4,'66f8627e678d9aaeb5a6eb21bee7ddc1ed6b55598c5b7df6650aa842820a6a91','2026-11-09 16:10:20',NULL,'2026-11-02 16:10:21',313),(4,'24c03b272aa807432fdd08f04cde3f4a0415092578959d065e44ab40637e88a5','2026-11-10 03:24:05','2026-11-03 03:38:06','2026-11-03 03:24:06',314),(4,'95cb441ea47a25429ca7a86be5c9a45622a71a3da921db507394bd5f05d9b9d1','2026-11-10 03:38:06','2026-11-05 02:58:34','2026-11-03 03:38:06',315),(4,'7a7bf49a962ca1052e2f4202f2d157913fa792ec6502cb995e0efa54e7a704cd','2026-11-11 13:50:38','2026-11-05 01:21:25','2026-11-04 13:50:38',316),(4,'070d05eb632f5aac4236a77aa48ada1207fa36c5863440d750bbc6b2f77807c2','2026-11-12 00:22:20','2026-11-05 03:07:25','2026-11-05 00:22:20',317),(4,'cc5f33660c0c3ba85bfb5ac3733f509428afb4614e0f1279ffed6f7759a8ab5e','2026-11-12 01:21:25','2026-11-05 01:35:35','2026-11-05 01:21:25',318),(4,'1fd3bb23746ac9c98ef219449ec8fe1676a307561e03267a4fd6ecdb0e774806','2026-11-12 01:35:35','2026-11-06 14:15:33','2026-11-05 01:35:35',319),(4,'32c38318d7d75345861e3fa4d53831f81d857fd741e280b851a3bfb0368af1df','2026-11-12 02:58:34','2026-11-05 03:12:35','2026-11-05 02:58:34',320),(4,'88a5d096f01d8393639e0c50e7d79fa202677a72581a1b380cfe7906c0376e67','2026-11-12 03:07:25','2026-11-05 03:22:36','2026-11-05 03:07:25',321),(4,'bba0f895754838e9dbfc42ffe77f40542e779bafbe0bb497e259259891ad0fbd','2026-11-12 03:12:35','2026-11-05 03:26:36','2026-11-05 03:12:35',322),(4,'c53f2a0c5ad7441f74fd1a7646466e25df28a7d8ab4d5175ddae651b2796b12e','2026-11-12 03:22:36','2026-11-05 03:50:45','2026-11-05 03:22:36',323),(4,'fb133e7cb04c80b0ca64065fa432a7a6ed17ce50e0a613651233c6cc4889ba67','2026-11-12 03:26:36','2026-11-05 07:56:12','2026-11-05 03:26:36',324),(4,'01c59e4b311d2e6a865407e3818dfdca5580e2e8e9931e355eba9e70278e99b1','2026-11-12 03:50:45','2026-11-05 06:17:22','2026-11-05 03:50:46',325),(1,'b1bc140e067fc66c573133da0d9642f942778defcb4db7569c2fc6f64e3ae4e4','2026-11-12 04:25:57','2026-11-06 09:02:28','2026-11-05 04:25:57',326),(4,'29bd03c5fd6b1e6cb4a915ec3659719919779c1a1326ba65ca187d264c25d426','2026-11-12 06:17:22','2026-11-05 12:42:20','2026-11-05 06:17:23',327),(4,'24ee7b019f0f9a41145157bc899300aff49f7590e3a4315a7e91032df09d83cc','2026-11-12 06:23:45','2026-11-05 14:39:24','2026-11-05 06:23:45',328),(4,'92cf91ec85aa4ea9ba67bcff23ffee8518fd5f6b1d80e959a2a5ba633008da9d','2026-11-12 07:56:12',NULL,'2026-11-05 07:56:12',329),(1,'6d22a7c8b45bc8bca02b1ef7f112ff358c8bada0bec1c11bb71d00188220ef85','2026-11-12 07:56:22','2026-11-05 08:10:22','2026-11-05 07:56:22',330),(4,'fab0cfa723107586c18b971d0de6c9316d8af959c79517e33cbc936ab58022d3','2026-11-12 07:57:46','2026-11-05 08:11:46','2026-11-05 07:57:46',331),(1,'afb41a75182d140ea2e26150b22c37b72177274e7b1255e19187f2745701f05f','2026-11-12 08:10:22','2026-11-05 08:24:23','2026-11-05 08:10:22',332),(4,'daf246f1d675b3b31e9386f2370d8c021f9bb3a3009b10115b5fc1f89d064162','2026-11-12 08:11:46','2026-11-05 08:25:47','2026-11-05 08:11:46',333),(1,'a90ba584c0ad9557624bf6808a884d20a44e8319acc71c5f80a3a843e05e14bb','2026-11-12 08:24:23','2026-11-05 08:38:24','2026-11-05 08:24:23',334),(4,'75acdecb6231f43690f9192da88278511d13388682c23bbfbb363b7819bf37fe','2026-11-12 08:25:47','2026-11-05 08:39:48','2026-11-05 08:25:47',335),(1,'4dafead6b054957aedf70f9784327f23e722eedbfc43a0ccac28bb103cec85d3','2026-11-12 08:38:24','2026-11-05 14:40:12','2026-11-05 08:38:24',336),(4,'7af44981ce9874b6b7a273aa493c7cb7e1e60bd191925e6698c1c8eafa8cea28','2026-11-12 08:39:48','2026-11-05 08:53:49','2026-11-05 08:39:48',337),(4,'3c6ae27b2ef31f8b3e3ae3a6c98881eef1a7c60926c147cba06e13b9c35c5e9a','2026-11-12 08:53:49','2026-11-05 09:07:50','2026-11-05 08:53:49',338),(4,'5db86ccdaf0804407df5dbae3acd731b570145d0888da597bf55c1b61104c67d','2026-11-12 09:07:50','2026-11-05 09:21:51','2026-11-05 09:07:50',339),(4,'8a47aba770e10658a43aecb2c39dc3775e98b68d91c5f2743b8ed6c98dcde7a9','2026-11-12 09:21:51',NULL,'2026-11-05 09:21:51',340),(4,'814c9a0ccde47139b2e31e668eceeed7c12e5c650b59d222ec7914c471fcd02a','2026-11-12 12:42:20','2026-11-05 14:39:15','2026-11-05 12:42:21',341),(4,'e483a52cef975f439eee9d6f054a3bcc05412137510199143b3c14e0d303753a','2026-11-12 14:39:15','2026-11-05 15:02:46','2026-11-05 14:39:16',342),(4,'7e55dd2184717931a93e64b3ba932d89a41246e33310b3bd9b27ae90d60d6118','2026-11-12 14:39:24','2026-11-05 14:57:54','2026-11-05 14:39:24',343),(1,'889e52d8a03ee2854e2a0d7fec8d761a3980d4baea62556d1a46bf571cc7b835','2026-11-12 14:40:12','2026-11-05 14:40:21','2026-11-05 14:40:12',344),(4,'473783b39a1c20ea6d25d9646f506bdf1d65e67ad96380df009278169728843c','2026-11-12 14:40:29','2026-11-05 14:54:30','2026-11-05 14:40:29',345),(4,'4cd34fb7c03b96f8cff9605563ecae5563886a85ae138be473cb14346369d6fd','2026-11-12 14:54:30','2026-11-05 15:08:31','2026-11-05 14:54:30',346),(4,'24cb9c6f3b7be62fbcc080de4716da4e73517c0f3879e891ee5303ff2a997106','2026-11-12 14:57:54','2026-11-05 15:11:55','2026-11-05 14:57:54',347),(4,'d4318639f8069911f43add6ebe20b65224ff92406024a917858979d93579618a','2026-11-12 15:02:46',NULL,'2026-11-05 15:02:46',348),(4,'7bf4432c56eed0a22fc753812cf6716c58c768591259b65a9f5891849e111a84','2026-11-12 15:08:31','2026-11-05 15:22:32','2026-11-05 15:08:31',349),(4,'b0175d2d2b8717a08167ce666972699acc43c2c63f81a489f5e196f10214e7fb','2026-11-12 15:11:55','2026-11-06 02:45:58','2026-11-05 15:11:55',350),(4,'cc07584acc9231a06626be1b6e1d5badf134dd25aae5c6c250f3e21a1ce74721','2026-11-12 15:22:32','2026-11-05 15:59:43','2026-11-05 15:22:33',351),(4,'6432d35bb52e459ea55c6d08f8a896af944434524042abf66b934b01fdf7ce02','2026-11-12 15:59:43','2026-11-05 16:13:44','2026-11-05 15:59:43',352),(4,'2a47efe02fdef2a1b4cc0f463c76f53440b74a0e609196368f2778f87d05c663','2026-11-12 16:13:44','2026-11-06 02:45:13','2026-11-05 16:13:44',353),(4,'5f1ad2d891a532901b4a37454c5251c3d639df6d54279d625521c5517e5d490c','2026-11-13 02:45:13','2026-11-06 02:59:14','2026-11-06 02:45:13',354),(4,'20ff3835c4bd42f975c2f75e08741d64aee0cb8ad0b917d6c6a9f5386c530d2e','2026-11-13 02:45:58','2026-11-06 03:37:58','2026-11-06 02:45:58',355),(4,'06339d2cf0858a414de8416025216dc5aa0ed8ad309b064ca523a224c117772a','2026-11-13 02:59:14','2026-11-06 03:13:15','2026-11-06 02:59:14',356),(4,'a8b12373345e43f390e27b76f539e5b774cc7fd162254783569dd3dc510b2721','2026-11-13 03:13:15','2026-11-06 03:40:30','2026-11-06 03:13:15',357),(4,'8dff0160ddf4a334c31d5594e652febf7b69b5eb4c71389bc94e31fc096e152a','2026-11-13 03:37:58','2026-11-06 09:01:11','2026-11-06 03:37:59',358),(4,'a49407b276b1f6e0299a5d3bed4cf3541a4edc99ebf7453a2b0da12d094948f1','2026-11-13 03:40:30','2026-11-06 13:28:01','2026-11-06 03:40:30',359),(4,'0a5d1116789fa7820a98df666dff4f5cb551e2b7d53ae8a8cb2c8f1c3bc2919a','2026-11-13 04:11:28','2026-11-06 09:02:03','2026-11-06 04:11:28',360),(4,'8dd906d5a08b0a299b91fa5bf26ffcf81557eff539a1d6eb346b1b5f61a9d251','2026-11-13 09:01:11','2026-11-06 15:42:19','2026-11-06 09:01:11',361),(4,'e276ee071e6d829551e42164d2af4a7aa1c65de50994fee39f9ac2b142adffd0','2026-11-13 09:02:03','2026-11-06 13:10:43','2026-11-06 09:02:03',362),(1,'eaf40aa0dcaf313e05326e0ef7308a45ad82059433fc31c4b9819c35e61859d5','2026-11-13 09:02:28','2026-11-06 09:02:44','2026-11-06 09:02:28',363),(4,'34b29ee24341d50604ab85a0380e8fde85fefe62825c9667c63d998068fd07cf','2026-11-13 09:02:56','2026-11-06 13:10:59','2026-11-06 09:02:56',364),(4,'e586020f13eb489c3dce92395c6d166739e20ecb6a139f13bdfb43c157e830f8','2026-11-13 13:10:43','2026-11-06 13:24:56','2026-11-06 13:10:43',365),(4,'52e474f265088948c591372488f7887df466e471cb95a2cd1755311cca13c14c','2026-11-13 13:10:59','2026-11-06 13:11:06','2026-11-06 13:10:59',366),(4,'74d144aa62dc795a83477d46abdbc5d63861ff684f866cb43bf52e58a2ce2f88','2026-11-13 13:11:06','2026-11-06 13:34:33','2026-11-06 13:11:06',367),(4,'221873b217e64fcf048aafc921ca6e66c96ebc0bb53ccc0963fec6f3ef749927','2026-11-13 13:24:56',NULL,'2026-11-06 13:24:56',368),(4,'527d3075c2ff2745b478bbebd74b1d5f399ca53b0b15cf290f432583ef65d895','2026-11-13 13:28:01','2026-11-06 13:42:03','2026-11-06 13:28:01',369),(4,'9b003baa8dff95fe16eeeb334fea0746399c5bf81fb50142704caff002749369','2026-11-13 13:34:33',NULL,'2026-11-06 13:34:33',370),(4,'cf8fcd3622873dff77060c016d2abce4c97ca5853ba4503a7f8aeab1d6fa2d98','2026-11-13 13:42:03','2026-11-06 13:56:04','2026-11-06 13:42:03',371),(4,'35cdce582dc96382733f1a435058c06472d831b5a42a512292d53dc46189fce9','2026-11-13 13:56:04','2026-11-06 14:10:08','2026-11-06 13:56:04',372),(4,'13722140499c083473d484c0cf3632f225febc027fc6b8b87b101a7984210bfe','2026-11-13 14:10:08','2026-11-06 14:18:09','2026-11-06 14:10:08',373),(4,'218654d84a7a100033293a94a6fb32ce97a3e3e2916d1b8f0391c43a51d64796','2026-11-13 14:15:33','2026-11-06 14:29:38','2026-11-06 14:15:33',374),(4,'9c6f72fc5f8f22594c78cdcff727a0262699f016b6742b23a58fc03be8ba9d00','2026-11-13 14:29:38','2026-11-11 13:10:22','2026-11-06 14:29:38',375),(4,'45e579add048c0a77c1f9e953e39c123b6d93f888d7b0a43c0c917828bdb2062','2026-11-13 14:48:44','2026-11-06 15:02:45','2026-11-06 14:48:44',376),(4,'f5ea3d1a4f6814b42a2e3790204f7023ee9136f294fddc7cffead2ea65120f6f','2026-11-13 15:02:45','2026-11-06 15:16:47','2026-11-06 15:02:45',377),(4,'922c031ba463cfd2dccde5926d092441ad500f648e3ea9afd0af6590af956c32','2026-11-13 15:16:47','2026-11-06 15:30:50','2026-11-06 15:16:47',378),(4,'00e9254d26f03edca5597735380660c3131c20ec7f403783c1542a12c8aece6f','2026-11-13 15:30:50','2026-11-06 15:44:52','2026-11-06 15:30:50',379),(4,'81155fb50fa16d1948231036ce1a35ba738877e98bd465d1f72b8c52361418c7','2026-11-13 15:42:19',NULL,'2026-11-06 15:42:19',380),(4,'dd56f8bf8ee70b628e48528d6580193419a3bb3492d59b0cfcac425babd76cb4','2026-11-13 15:44:52','2026-11-06 15:58:54','2026-11-06 15:44:52',381),(4,'8c5801118eda26206802234324d275c0ea2843b4d1d00ecfe7de8c372de0dbd0','2026-11-13 15:58:54','2026-11-08 13:17:21','2026-11-06 15:58:54',382),(4,'dea5689a3ae73dc6cb62c1584cb6c026b5cd212c1482fe4e8caf75f2014b4f2a','2026-11-15 13:17:21','2026-11-08 13:17:24','2026-11-08 13:17:22',383),(4,'f7e15cb97dcb06788a28bd469f808fa67e9d6a113cb0c2c717426156a61a6603','2026-11-15 13:17:24','2026-11-08 13:31:24','2026-11-08 13:17:24',384),(4,'90101361f6d388a7825e288ddfbaa8390b2e7ff7a84ea499a8b696aa5e87e05e','2026-11-15 13:31:24','2026-11-08 13:45:25','2026-11-08 13:31:25',385),(4,'fce132f2bd603cca2bc55935dac7febaf9624ad625127cce1db01b7b74992e84','2026-11-15 13:45:25','2026-11-08 13:59:26','2026-11-08 13:45:26',386),(4,'7bd2ac7f7b472671dcb0b8c56406fd13c4d5e0f9b6102d05863b1fd6730f2ceb','2026-11-15 13:59:26','2026-11-08 14:13:28','2026-11-08 13:59:27',387),(4,'06100174b7ca3c25212ead24e61a2b52e960b3b8a335e1bcd0a1c846e979a8a0','2026-11-15 14:13:28','2026-11-08 14:27:28','2026-11-08 14:13:28',388),(4,'4c3760c3eec8b1853d68848d17b1e745e48720d32e1ae18d7cc36a7523d887b3','2026-11-15 14:27:28','2026-11-08 14:41:29','2026-11-08 14:27:29',389),(4,'1cc952e3b46c778923a6a22e7156e81828a11866c6d5c4606189d5ac6b139e61','2026-11-15 14:41:29','2026-11-08 14:55:30','2026-11-08 14:41:29',390),(4,'43206f49a22d44fc66a2965ff81bb14871102625d586910294940ecae5238e51','2026-11-15 14:55:30','2026-11-08 15:09:30','2026-11-08 14:55:30',391),(4,'652e8852e19d57189f1cdb1d9f725196db2d79715e55efa3ae7acb5fbb040619','2026-11-15 15:09:30','2026-11-09 11:03:08','2026-11-08 15:09:31',392),(4,'f99c11cbd82a8e77e61d87df1dd1d9ea5409daba271cfe0cd8c837448a978c2a','2026-11-16 11:03:08',NULL,'2026-11-09 11:03:08',393),(4,'08fc428481cc5ef95ecfb100264a838d9ddcfb362bc8876d967705200eec7f70','2026-11-16 11:03:33','2026-11-10 14:03:57','2026-11-09 11:03:33',394),(4,'40d4d5bc55cf3006882ae3e907197ddc3511929981609b6687f946bee94363bd','2026-11-17 14:03:57','2026-11-13 02:09:11','2026-11-10 14:03:57',395),(4,'c47519d19e5cf59f1b4183b51b4260134ca18bddc2e849c5b6f9c4cd326ad1e4','2026-11-18 13:10:22','2026-11-11 13:24:26','2026-11-11 13:10:23',396),(4,'5407697c0bd2dd953b2001c2481fc2e204d3c2e1b4e4176d90dc580044746dfc','2026-11-18 13:24:26','2026-11-11 13:38:30','2026-11-11 13:24:27',397),(4,'b986afe721eae4317545921e6c6c8ad1c4058981c68dab0e79dab425732e1483','2026-11-18 13:38:30','2026-11-11 13:52:34','2026-11-11 13:38:31',398),(4,'473a5766dc5385ac2f7d979036e0a08e060b816554f19434bfef66e0c8a78b83','2026-11-18 13:52:34','2026-11-11 14:06:41','2026-11-11 13:52:34',399),(4,'cf3b461d980c70d5d7ee3c0f6c3daac81d2649b63b6018924b849816b1e84798','2026-11-18 14:06:41','2026-11-11 14:20:45','2026-11-11 14:06:42',400),(4,'4c745a5ab26bc12bd19ccc01cd8be647d1dcc6fdfafb09cac5da6569f0cd1d66','2026-11-18 14:20:45','2026-11-11 14:34:49','2026-11-11 14:20:46',401),(4,'28f25954e6d9bf2e027c9b6dd0ef44bbcc9910a52d9bd00a1e1749494c8fd346','2026-11-18 14:34:49','2026-11-11 14:48:54','2026-11-11 14:34:49',402),(4,'c928d40771192d878a6f446b59a0aadfd146588cf6f398640f085b2e33a1d938','2026-11-18 14:48:54','2026-11-12 14:36:58','2026-11-11 14:48:54',403),(4,'3076508b3bbcc3ef45d514f4f5ff90ac4939c618da80718dee18f6e383e3dcc0','2026-11-19 14:36:58','2026-11-13 12:53:38','2026-11-12 14:36:59',404),(4,'478e1646e831e9e49aeaf4c8063c9958cabee984405d72476c2748299dd76f1e','2026-11-20 02:09:11','2026-11-13 02:23:12','2026-11-13 02:09:11',405),(4,'46b2b4372804cf0754b55a14501c073ec227e5b0e98399146e98f75c1ee512eb','2026-11-20 02:23:12','2026-11-13 02:37:12','2026-11-13 02:23:12',406),(4,'c1200c75ec5f2a3614e114fb013c81884cf4f75cfef3c5f5b4129068553263ed','2026-11-20 02:37:12','2026-11-17 12:51:03','2026-11-13 02:37:12',407),(4,'46c4622409ed1c062cb1bdc3af9cc7d65d4eb35924180a9d9c433b0f2f885d22','2026-11-20 12:53:38','2026-11-13 12:53:41','2026-11-13 12:53:39',408),(4,'29db3140f2f49e035df81d78a8fd75731b9af6af4b69d239ba06a4e7bbded08f','2026-11-20 12:53:41','2026-11-13 12:53:51','2026-11-13 12:53:41',409),(4,'4a29ce7376e79237996880e698b9f462515f2e99059987b4c51b9fea6edf2cd4','2026-11-20 12:53:51','2026-11-13 13:07:53','2026-11-13 12:53:51',410),(4,'28c98c4dd0e36dfae4488768d42f2577444f6a20da4b75e859c4914b6503cd10','2026-11-20 13:07:53','2026-11-13 13:21:56','2026-11-13 13:07:54',411),(4,'f9d762698d73ea67c32a682fea94cf33af86a5c140c7a8facecbec4bd3bb6b54','2026-11-20 13:21:56','2026-11-13 13:35:58','2026-11-13 13:21:56',412),(4,'5a37f193ad15e3a1b5ad0b3bb2ebeea9819385b9c49415424edf46f4065f1d6f','2026-11-20 13:35:58','2026-11-13 13:50:01','2026-11-13 13:35:59',413),(4,'8c14a24026b82c975897ea3e42473fc613bd9a9e2e5fa54d991fbb68777cc3e2','2026-11-20 13:50:01','2026-11-17 13:16:35','2026-11-13 13:50:01',414),(4,'68387bd49d521ecb652e282474a7c50a5ae8b785d0f7a2dbde1681d35964571b','2026-11-24 12:51:03',NULL,'2026-11-17 12:51:04',415),(4,'7ef62108115e3d3a9dbf60254b8754659874555564b2233dbfa2fbe438a61770','2026-11-24 13:16:35','2026-11-17 13:30:36','2026-11-17 13:16:35',416),(4,'c33cbd3155711940aa8e3af7497b45e3846dc346ff6a9262cd0a7f6687f02c17','2026-11-24 13:30:36','2026-11-17 13:44:46','2026-11-17 13:30:36',417),(4,'7c8171eb9fe493d29b81f686bd2d4ad5d15f8d2138d1e4eed835db07a8099843','2026-11-24 13:44:46','2026-11-18 13:19:11','2026-11-17 13:44:46',418),(4,'ee71c9ea58c5e6643b89b49c1a0d35fb2e0f16dbded1bc07918d6a31572640dc','2026-11-25 13:19:11','2026-11-18 13:19:30','2026-11-18 13:19:11',419),(4,'dad39b5f242fd647cf67e0f0ca52fb02f112f3ad05144a8d7bc7836b89e4ee80','2026-11-25 13:19:30','2026-11-18 13:33:31','2026-11-18 13:19:30',420),(4,'84440f687224bbeec057b3044175c2fee2d24f7deb394e5a34cd190dbce79427','2026-11-25 13:22:46','2026-11-18 13:36:45','2026-11-18 13:22:46',421),(4,'949751b5e77465988514b4a909129e50889f0f1be55dd4829bede177b50c21f0','2026-11-25 13:33:31','2026-11-18 13:47:32','2026-11-18 13:33:31',422),(4,'9e03c14295ca789459b9df1f7f2cf11a0b13781102bfeb329b07c45876c7e28e','2026-11-25 13:36:45',NULL,'2026-11-18 13:36:45',423),(4,'a08cfb5ad09b34821b0346ff2c87671714c20d7377b309667b39f6307ff42f5c','2026-11-25 13:47:32','2026-11-18 14:01:33','2026-11-18 13:47:32',424),(4,'27498dd275aa749da8e369afa6fc813e4ea631b6563b6d5e4e35784c23ea64ea','2026-11-25 14:01:33',NULL,'2026-11-18 14:01:33',425),(4,'ee853170046e840461acfede2a430f37eb38d1f7c06ceb55b6e94c51741475ea','2026-11-27 02:35:10',NULL,'2026-11-20 02:35:10',426);
/*!40000 ALTER TABLE `refresh_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales_areas`
--

DROP TABLE IF EXISTS `sales_areas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales_areas` (
  `code` varchar(50) NOT NULL,
  `name` varchar(120) NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `id` int NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sales_areas_code` (`code`),
  UNIQUE KEY `uq_sales_areas_name` (`name`),
  KEY `ix_sales_areas_active_name` (`is_active`,`name`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales_areas`
--

LOCK TABLES `sales_areas` WRITE;
/*!40000 ALTER TABLE `sales_areas` DISABLE KEYS */;
INSERT INTO `sales_areas` VALUES ('custom_af355112247c49b8ae83b6933063d22f','bá sàn',1,17),('custom_95e706e91cb24ced8c542cc1fd3339f8','Vãi xoài',1,18);
/*!40000 ALTER TABLE `sales_areas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales_invoice_items`
--

DROP TABLE IF EXISTS `sales_invoice_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales_invoice_items` (
  `quantity` decimal(18,3) NOT NULL,
  `unit_price` decimal(14,2) NOT NULL,
  `sales_invoice_id` int NOT NULL,
  `product_id` int NOT NULL,
  `id` int NOT NULL AUTO_INCREMENT,
  `combo_id` int DEFAULT NULL,
  `entered_unit` varchar(50) DEFAULT NULL,
  `entered_quantity` decimal(18,3) DEFAULT NULL,
  `landed_unit_cost` decimal(18,4) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sales_item_product` (`sales_invoice_id`,`product_id`),
  KEY `ix_sales_invoice_items_sales_invoice_id` (`sales_invoice_id`),
  KEY `ix_sales_invoice_items_product_id` (`product_id`),
  CONSTRAINT `sales_invoice_items_ibfk_1` FOREIGN KEY (`sales_invoice_id`) REFERENCES `sales_invoices` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sales_invoice_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `ck_sales_item_price` CHECK ((`unit_price` >= 0)),
  CONSTRAINT `ck_sales_item_qty` CHECK ((`quantity` > 0))
) ENGINE=InnoDB AUTO_INCREMENT=769 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales_invoice_items`
--

LOCK TABLES `sales_invoice_items` WRITE;
/*!40000 ALTER TABLE `sales_invoice_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `sales_invoice_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales_invoice_workflow_events`
--

DROP TABLE IF EXISTS `sales_invoice_workflow_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales_invoice_workflow_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sales_invoice_id` int NOT NULL,
  `actor_id` int NOT NULL,
  `action` varchar(32) NOT NULL,
  `detail` varchar(255) DEFAULT NULL,
  `occurred_at` datetime NOT NULL,
  `recipient_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_sales_invoice_workflow_events_invoice_id` (`sales_invoice_id`,`id`),
  KEY `fk_sales_workflow_actor` (`actor_id`),
  KEY `ix_sales_invoice_workflow_recipient` (`recipient_id`),
  CONSTRAINT `fk_sales_invoice_workflow_recipient` FOREIGN KEY (`recipient_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_sales_workflow_actor` FOREIGN KEY (`actor_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_sales_workflow_invoice` FOREIGN KEY (`sales_invoice_id`) REFERENCES `sales_invoices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=512 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales_invoice_workflow_events`
--

LOCK TABLES `sales_invoice_workflow_events` WRITE;
/*!40000 ALTER TABLE `sales_invoice_workflow_events` DISABLE KEYS */;
/*!40000 ALTER TABLE `sales_invoice_workflow_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales_invoices`
--

DROP TABLE IF EXISTS `sales_invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales_invoices` (
  `sold_at` datetime NOT NULL,
  `note` text,
  `status` enum('DRAFT','PROCESSING','DELIVERING','COMPLETED','CANCELLED') NOT NULL,
  `cancel_requested` tinyint(1) NOT NULL,
  `cancel_note` text,
  `discount_amount` decimal(14,2) NOT NULL,
  `discount_status` enum('NO_DISCOUNT','AUTO_APPROVED','PENDING_APPROVAL','APPROVED','REJECTED') NOT NULL,
  `discount_note` text,
  `discount_approved_by` int DEFAULT NULL,
  `sale_source` enum('CENTRAL_WAREHOUSE','EMPLOYEE_STOCK') NOT NULL,
  `payment_status` enum('UNPAID','PARTIAL','PAID') NOT NULL,
  `paid_amount` decimal(14,2) NOT NULL,
  `payment_due_date` date DEFAULT NULL,
  `warehouse_id` int NOT NULL,
  `customer_id` int NOT NULL,
  `employee_id` int NOT NULL,
  `sales_area_id` int DEFAULT NULL,
  `id` int NOT NULL AUTO_INCREMENT,
  `warehouse_submitted_at` datetime DEFAULT NULL,
  `delivered_at` datetime DEFAULT NULL,
  `delivery_recipient` varchar(120) DEFAULT NULL,
  `delivery_note` text,
  `delivery_method` varchar(16) DEFAULT NULL,
  `delivery_employee_id` int DEFAULT NULL,
  `delivery_service` varchar(120) DEFAULT NULL,
  `tracking_number` varchar(120) DEFAULT NULL,
  `shipping_fee` decimal(14,2) DEFAULT NULL,
  `shipping_fund_method` varchar(20) DEFAULT NULL,
  `shipping_charged_at` datetime DEFAULT NULL,
  `current_assignee_id` int DEFAULT NULL,
  `assignment_stage` varchar(20) DEFAULT NULL,
  `assigned_at` datetime DEFAULT NULL,
  `accepted_at` datetime DEFAULT NULL,
  `accounting_handoff_at` datetime DEFAULT NULL,
  `return_pending` tinyint(1) NOT NULL DEFAULT '0',
  `payment_due_original_date` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_sales_invoices_sale_source` (`sale_source`),
  KEY `ix_sales_invoices_payment_status` (`payment_status`),
  KEY `ix_sales_invoices_discount_approved_by` (`discount_approved_by`),
  KEY `ix_sales_invoices_customer_id` (`customer_id`),
  KEY `ix_sales_invoices_sales_area_id` (`sales_area_id`),
  KEY `ix_sales_invoices_status_date` (`status`,`sold_at`),
  KEY `ix_sales_invoices_warehouse_id` (`warehouse_id`),
  KEY `ix_sales_invoices_customer_date` (`customer_id`,`sold_at`),
  KEY `ix_sales_invoices_employee_id` (`employee_id`),
  KEY `ix_sales_invoices_payment_due` (`status`,`payment_status`,`payment_due_date`),
  KEY `ix_sales_invoices_warehouse_queue` (`status`,`warehouse_submitted_at`),
  KEY `ix_sales_invoices_delivery_queue` (`status`,`delivered_at`),
  KEY `ix_sales_invoices_delivery_employee_id` (`delivery_employee_id`),
  KEY `ix_sales_invoices_current_assignee_id` (`current_assignee_id`),
  CONSTRAINT `fk_sales_invoice_current_assignee` FOREIGN KEY (`current_assignee_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_sales_invoices_delivery_employee` FOREIGN KEY (`delivery_employee_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `sales_invoices_ibfk_1` FOREIGN KEY (`discount_approved_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL,
  CONSTRAINT `sales_invoices_ibfk_2` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `sales_invoices_ibfk_3` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `sales_invoices_ibfk_4` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `sales_invoices_ibfk_5` FOREIGN KEY (`sales_area_id`) REFERENCES `sales_areas` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `ck_discount_amount` CHECK ((`discount_amount` >= 0)),
  CONSTRAINT `ck_sales_invoice_paid_amount` CHECK ((`paid_amount` >= 0))
) ENGINE=InnoDB AUTO_INCREMENT=371 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales_invoices`
--

LOCK TABLES `sales_invoices` WRITE;
/*!40000 ALTER TABLE `sales_invoices` DISABLE KEYS */;
/*!40000 ALTER TABLE `sales_invoices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_transfer_items`
--

DROP TABLE IF EXISTS `stock_transfer_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_transfer_items` (
  `quantity` decimal(18,3) NOT NULL,
  `stock_transfer_id` int NOT NULL,
  `product_id` int NOT NULL,
  `id` int NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_stock_transfer_product` (`stock_transfer_id`,`product_id`),
  KEY `ix_stock_transfer_items_stock_transfer_id` (`stock_transfer_id`),
  KEY `ix_stock_transfer_items_product_id` (`product_id`),
  CONSTRAINT `stock_transfer_items_ibfk_1` FOREIGN KEY (`stock_transfer_id`) REFERENCES `stock_transfers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `stock_transfer_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `ck_stock_transfer_item_qty` CHECK ((`quantity` > 0))
) ENGINE=InnoDB AUTO_INCREMENT=515 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_transfer_items`
--

LOCK TABLES `stock_transfer_items` WRITE;
/*!40000 ALTER TABLE `stock_transfer_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `stock_transfer_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_transfers`
--

DROP TABLE IF EXISTS `stock_transfers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_transfers` (
  `transferred_at` datetime NOT NULL,
  `note` text,
  `warehouse_id` int NOT NULL,
  `employee_id` int NOT NULL,
  `created_by_employee_id` int NOT NULL,
  `id` int NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id`),
  KEY `ix_stock_transfers_warehouse_date` (`warehouse_id`,`transferred_at`),
  KEY `ix_stock_transfers_warehouse_id` (`warehouse_id`),
  KEY `ix_stock_transfers_employee_date` (`employee_id`,`transferred_at`),
  KEY `ix_stock_transfers_created_by_employee_id` (`created_by_employee_id`),
  KEY `ix_stock_transfers_employee_id` (`employee_id`),
  CONSTRAINT `stock_transfers_ibfk_1` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `stock_transfers_ibfk_2` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `stock_transfers_ibfk_3` FOREIGN KEY (`created_by_employee_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=144 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_transfers`
--

LOCK TABLES `stock_transfers` WRITE;
/*!40000 ALTER TABLE `stock_transfers` DISABLE KEYS */;
/*!40000 ALTER TABLE `stock_transfers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `supplier_payments`
--

DROP TABLE IF EXISTS `supplier_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `supplier_payments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `amount` decimal(14,2) NOT NULL,
  `payment_method` enum('cash','bank_transfer') NOT NULL,
  `paid_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `note` text,
  `supplier_id` int NOT NULL,
  `import_invoice_id` int NOT NULL,
  `employee_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `supplier_id` (`supplier_id`),
  KEY `import_invoice_id` (`import_invoice_id`),
  KEY `employee_id` (`employee_id`),
  CONSTRAINT `supplier_payments_ibfk_1` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `supplier_payments_ibfk_2` FOREIGN KEY (`import_invoice_id`) REFERENCES `import_invoices` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `supplier_payments_ibfk_3` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `ck_supplier_payment_amount` CHECK ((`amount` >= 500))
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `supplier_payments`
--

LOCK TABLES `supplier_payments` WRITE;
/*!40000 ALTER TABLE `supplier_payments` DISABLE KEYS */;
/*!40000 ALTER TABLE `supplier_payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `suppliers`
--

DROP TABLE IF EXISTS `suppliers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `suppliers` (
  `name` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `address` text NOT NULL,
  `id` int NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=268 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `suppliers`
--

LOCK TABLES `suppliers` WRITE;
/*!40000 ALTER TABLE `suppliers` DISABLE KEYS */;
INSERT INTO `suppliers` VALUES ('Quảng châu','0907720206','ai bt',267);
/*!40000 ALTER TABLE `suppliers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `warehouses`
--

DROP TABLE IF EXISTS `warehouses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `warehouses` (
  `name` varchar(150) NOT NULL,
  `address` varchar(255) NOT NULL,
  `id` int NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_warehouse_address` (`name`,`address`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `warehouses`
--

LOCK TABLES `warehouses` WRITE;
/*!40000 ALTER TABLE `warehouses` DISABLE KEYS */;
INSERT INTO `warehouses` VALUES ('Kho trung tâm','Ho Chi Minh city',9);
/*!40000 ALTER TABLE `warehouses` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-20 11:00:37

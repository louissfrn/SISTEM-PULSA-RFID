-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Dec 23, 2025 at 11:31 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `sistem_rfid_lijaya`
--

-- --------------------------------------------------------

--
-- Table structure for table `admin`
--

CREATE TABLE `admin` (
  `Admin_ID` int(11) NOT NULL,
  `Username` varchar(50) NOT NULL,
  `Password_hash` varchar(255) NOT NULL,
  `Full_Name` varchar(100) DEFAULT NULL,
  `Role` enum('administrator','kasir') NOT NULL DEFAULT 'kasir',
  `Status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `Last_Login` datetime DEFAULT NULL,
  `Created_at` datetime DEFAULT current_timestamp(),
  `Updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `admin`
--

INSERT INTO `admin` (`Admin_ID`, `Username`, `Password_hash`, `Full_Name`, `Role`, `Status`, `Last_Login`, `Created_at`, `Updated_at`) VALUES
(1, 'admin', '$2b$10$3DiIyZNRpD0UVJvp2SBi/emFI6Pff91Yhl6OUNfRWumyGetXFOvkq', '', 'administrator', 'active', '2025-11-04 21:55:43', '2025-10-17 20:03:40', '2025-11-04 21:55:43'),
(2, 'louis18', '$2b$10$244Wr.jAAzUJAXngLyeD8OiCbYSL9X2gHOFO1rrnok67sqTv7nTD.', 'Louis Francis', 'administrator', 'active', '2025-11-13 23:38:55', '2025-11-04 17:25:02', '2025-11-13 23:38:55'),
(3, 'John20', '$2b$10$Xt5DSxbgeZK/IbbxM1oyp.VSfIpKxgeM8l99XpWEOgxyRcryeLEqS', 'John Doe', 'administrator', 'active', NULL, '2025-11-10 22:13:52', '2025-11-10 22:13:52'),
(4, 'louis2', '$2b$10$KyeH58v6njHutgdO2Eyr9OIfzqbERb8DFAFS6zxtM1O9m5e4KXs4q', 'louis fran', 'administrator', 'active', '2025-11-12 01:39:35', '2025-11-12 01:33:51', '2025-11-12 01:39:35');

-- --------------------------------------------------------

--
-- Table structure for table `balance_history`
--

CREATE TABLE `balance_history` (
  `History_ID` int(11) NOT NULL,
  `RFID_Card_ID` int(11) NOT NULL,
  `Transaction_ID` int(11) DEFAULT NULL,
  `Transaction_Type` enum('top_up','deduction','refund','adjustment') NOT NULL,
  `Amount` decimal(10,2) NOT NULL,
  `Balance_Before` decimal(10,2) NOT NULL,
  `Balance_After` decimal(10,2) NOT NULL,
  `Created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customer`
--

CREATE TABLE `customer` (
  `Customer_ID` int(11) NOT NULL,
  `Name` varchar(100) NOT NULL,
  `Email` varchar(100) DEFAULT NULL,
  `Phone_Number` varchar(15) NOT NULL,
  `Registration_Date` datetime DEFAULT current_timestamp(),
  `Status` enum('pending','active','rejected') NOT NULL DEFAULT 'pending',
  `Created_at` datetime DEFAULT current_timestamp(),
  `Updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `product`
--

CREATE TABLE `product` (
  `Product_ID` int(11) NOT NULL,
  `Product_Name` varchar(100) NOT NULL,
  `Category` enum('pulsa') DEFAULT NULL,
  `Telco_Provider` enum('telkomsel','xl','indosat','tri','smartfren','all') NOT NULL,
  `Description` text DEFAULT NULL,
  `Status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `Created_at` datetime DEFAULT current_timestamp(),
  `Updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `product`
--

INSERT INTO `product` (`Product_ID`, `Product_Name`, `Category`, `Telco_Provider`, `Description`, `Status`, `Created_at`, `Updated_at`) VALUES
(1, 'Telkomsel', 'pulsa', 'telkomsel', 'Produk pulsa Telkomsel', 'active', '2025-09-27 18:27:57', '2025-09-27 18:27:57'),
(2, 'XL', 'pulsa', 'xl', 'Produk pulsa XL', 'active', '2025-09-27 18:27:57', '2025-11-04 23:06:14'),
(3, 'Indosat', 'pulsa', 'indosat', 'Produk pulsa Indosat', 'active', '2025-09-27 18:27:57', '2025-11-04 23:05:57'),
(4, 'Three', 'pulsa', 'tri', 'Produk pulsa Three', 'active', '2025-09-27 18:27:57', '2025-11-07 17:14:38');

-- --------------------------------------------------------

--
-- Table structure for table `product_detail`
--

CREATE TABLE `product_detail` (
  `Product_Detail_ID` int(11) NOT NULL,
  `Product_ID` int(11) NOT NULL,
  `Detail_Name` varchar(100) NOT NULL,
  `Nominal` decimal(10,2) NOT NULL,
  `Cost_Price` decimal(10,2) NOT NULL,
  `Selling_Price` decimal(10,2) NOT NULL,
  `IAK_Product_Code` varchar(50) DEFAULT NULL,
  `Status` enum('active','inactive','out_of_stock') DEFAULT 'active',
  `Created_at` datetime NOT NULL,
  `Updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `product_detail`
--

INSERT INTO `product_detail` (`Product_Detail_ID`, `Product_ID`, `Detail_Name`, `Nominal`, `Cost_Price`, `Selling_Price`, `IAK_Product_Code`, `Status`, `Created_at`, `Updated_at`) VALUES
(1, 1, 'Pulsa Telkomsel 2.000', 2000.00, 2100.00, 2500.00, 'htelkomsel2000', 'active', '2025-11-13 09:40:06', '2025-11-13 09:40:06');

-- --------------------------------------------------------

--
-- Table structure for table `rfid_card`
--

CREATE TABLE `rfid_card` (
  `RFID_Card_ID` int(11) NOT NULL,
  `Customer_ID` int(11) NOT NULL,
  `RFID_Code` varchar(255) DEFAULT NULL,
  `Balance` decimal(10,2) DEFAULT 0.00,
  `Status` enum('active','pending','blocked','lost','rejected') NOT NULL DEFAULT 'pending',
  `Issue_Date` datetime DEFAULT current_timestamp(),
  `Activated_At` timestamp NULL DEFAULT NULL,
  `Activated_By` int(11) DEFAULT NULL,
  `Rejected_By` int(11) DEFAULT NULL,
  `Created_at` datetime DEFAULT current_timestamp(),
  `Updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sim_card`
--

CREATE TABLE `sim_card` (
  `SIM_ID` int(11) NOT NULL,
  `Phone_Number` varchar(15) NOT NULL,
  `Barcode` varchar(100) NOT NULL,
  `Provider` enum('telkomsel','xl','indosat','tri','smartfren') NOT NULL,
  `Purchase_Price` decimal(10,2) NOT NULL,
  `Selling_Price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `Status` enum('available','sold','reserved','inactive') NOT NULL DEFAULT 'available',
  `Activated_Date` datetime DEFAULT NULL,
  `Created_at` datetime DEFAULT current_timestamp(),
  `Updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `sim_card`
--

INSERT INTO `sim_card` (`SIM_ID`, `Phone_Number`, `Barcode`, `Provider`, `Purchase_Price`, `Selling_Price`, `Status`, `Activated_Date`, `Created_at`, `Updated_at`) VALUES
(14, '085385078901', 'S261X025000010004468800001', 'telkomsel', 50000.00, 70000.00, 'sold', NULL, '2025-11-12 01:55:12', '2025-11-13 20:04:36');

-- --------------------------------------------------------

--
-- Table structure for table `transaction`
--

CREATE TABLE `transaction` (
  `Transaction_ID` int(11) NOT NULL,
  `Customer_ID` int(11) DEFAULT NULL,
  `RFID_Card_ID` int(11) DEFAULT NULL,
  `Product_Detail_ID` int(11) DEFAULT NULL,
  `SIM_ID` int(11) DEFAULT NULL,
  `Admin_ID` int(11) DEFAULT NULL,
  `Target_Phone_Number` varchar(15) DEFAULT NULL,
  `Transaction_Code` varchar(50) NOT NULL,
  `Transaction_Type` enum('top_up_saldo','isi_pulsa','beli_paket','beli_sim','pendaftaran_rfid') NOT NULL,
  `Total_Amount` decimal(10,2) NOT NULL,
  `Payment_Method` enum('qris','cash','saldo_rfid') NOT NULL,
  `Payment_Status` enum('pending','success','failed','cancelled') NOT NULL DEFAULT 'pending',
  `Transaction_Date` datetime DEFAULT current_timestamp(),
  `Created_at` datetime DEFAULT current_timestamp(),
  `Updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `admin`
--
ALTER TABLE `admin`
  ADD PRIMARY KEY (`Admin_ID`),
  ADD UNIQUE KEY `Username` (`Username`);

--
-- Indexes for table `balance_history`
--
ALTER TABLE `balance_history`
  ADD PRIMARY KEY (`History_ID`),
  ADD KEY `RFID_Card_ID` (`RFID_Card_ID`),
  ADD KEY `Transaction_ID` (`Transaction_ID`);

--
-- Indexes for table `customer`
--
ALTER TABLE `customer`
  ADD PRIMARY KEY (`Customer_ID`),
  ADD UNIQUE KEY `Phone_Number` (`Phone_Number`),
  ADD UNIQUE KEY `Email` (`Email`);

--
-- Indexes for table `product`
--
ALTER TABLE `product`
  ADD PRIMARY KEY (`Product_ID`);

--
-- Indexes for table `product_detail`
--
ALTER TABLE `product_detail`
  ADD PRIMARY KEY (`Product_Detail_ID`),
  ADD KEY `Product_ID` (`Product_ID`);

--
-- Indexes for table `rfid_card`
--
ALTER TABLE `rfid_card`
  ADD PRIMARY KEY (`RFID_Card_ID`),
  ADD UNIQUE KEY `RFID_Code` (`RFID_Code`),
  ADD KEY `Customer_ID` (`Customer_ID`),
  ADD KEY `fk_activated_by` (`Activated_By`);

--
-- Indexes for table `sim_card`
--
ALTER TABLE `sim_card`
  ADD PRIMARY KEY (`SIM_ID`),
  ADD UNIQUE KEY `Phone_Number` (`Phone_Number`),
  ADD UNIQUE KEY `Barcode` (`Barcode`);

--
-- Indexes for table `transaction`
--
ALTER TABLE `transaction`
  ADD PRIMARY KEY (`Transaction_ID`),
  ADD UNIQUE KEY `Transaction_Code` (`Transaction_Code`),
  ADD KEY `Customer_ID` (`Customer_ID`),
  ADD KEY `RFID_Card_ID` (`RFID_Card_ID`),
  ADD KEY `Cashier_ID` (`Admin_ID`),
  ADD KEY `SIM_ID` (`SIM_ID`),
  ADD KEY `Product_Detail_ID` (`Product_Detail_ID`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `admin`
--
ALTER TABLE `admin`
  MODIFY `Admin_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `balance_history`
--
ALTER TABLE `balance_history`
  MODIFY `History_ID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customer`
--
ALTER TABLE `customer`
  MODIFY `Customer_ID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `product`
--
ALTER TABLE `product`
  MODIFY `Product_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `product_detail`
--
ALTER TABLE `product_detail`
  MODIFY `Product_Detail_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `rfid_card`
--
ALTER TABLE `rfid_card`
  MODIFY `RFID_Card_ID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `sim_card`
--
ALTER TABLE `sim_card`
  MODIFY `SIM_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `transaction`
--
ALTER TABLE `transaction`
  MODIFY `Transaction_ID` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `balance_history`
--
ALTER TABLE `balance_history`
  ADD CONSTRAINT `balance_history_ibfk_1` FOREIGN KEY (`RFID_Card_ID`) REFERENCES `rfid_card` (`RFID_Card_ID`) ON DELETE CASCADE,
  ADD CONSTRAINT `balance_history_ibfk_2` FOREIGN KEY (`Transaction_ID`) REFERENCES `transaction` (`Transaction_ID`) ON DELETE SET NULL;

--
-- Constraints for table `product_detail`
--
ALTER TABLE `product_detail`
  ADD CONSTRAINT `product_detail_ibfk_1` FOREIGN KEY (`Product_ID`) REFERENCES `product` (`Product_ID`);

--
-- Constraints for table `rfid_card`
--
ALTER TABLE `rfid_card`
  ADD CONSTRAINT `fk_activated_by` FOREIGN KEY (`Activated_By`) REFERENCES `admin` (`Admin_ID`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `rfid_card_ibfk_1` FOREIGN KEY (`Customer_ID`) REFERENCES `customer` (`Customer_ID`) ON DELETE CASCADE;

--
-- Constraints for table `transaction`
--
ALTER TABLE `transaction`
  ADD CONSTRAINT `transaction_ibfk_1` FOREIGN KEY (`Customer_ID`) REFERENCES `customer` (`Customer_ID`) ON DELETE CASCADE,
  ADD CONSTRAINT `transaction_ibfk_2` FOREIGN KEY (`SIM_ID`) REFERENCES `sim_card` (`SIM_ID`),
  ADD CONSTRAINT `transaction_ibfk_3` FOREIGN KEY (`Product_Detail_ID`) REFERENCES `product_detail` (`Product_Detail_ID`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

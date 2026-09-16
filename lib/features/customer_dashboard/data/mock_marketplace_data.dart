import '../../companies/domain/entities/company.dart';
import '../../products/domain/entities/product.dart';

const List<Company> mockCompanies = [
  Company(
    id: 'c1',
    name: 'Khartoum Tech Solutions',
    rating: 4.9,
    reviewCount: 54,
    description:
        'Leading IT network equipment and infrastructure solutions provider in Sudan. Authorized partner for enterprise hardware with official warranty.',
    city: 'Khartoum',
    address: 'Al-Siteen Street, Khartoum',
    phone: '+249 91 234 5678',
  ),
  Company(
    id: 'c2',
    name: 'Nile IT & Cloud Systems',
    rating: 4.8,
    reviewCount: 38,
    description:
        'Specialized in enterprise servers, data storage systems, and corporate IT hardware distribution across Sudan.',
    city: 'Khartoum',
    address: 'Al-Manshiya, Khartoum',
    phone: '+249 92 345 6789',
  ),
  Company(
    id: 'c3',
    name: 'Red Sea Networking Co.',
    rating: 4.7,
    reviewCount: 29,
    description:
        'Authorized distributor for high-speed fiber optics, routers, managed switches, and certified structured cabling.',
    city: 'Port Sudan',
    address: 'Port Sudan Main Market',
    phone: '+249 93 456 7890',
  ),
  Company(
    id: 'c4',
    name: 'Blue Nile Technologies',
    rating: 4.6,
    reviewCount: 21,
    description:
        'Complete commercial surveillance, security systems, and high-performance computing equipment.',
    city: 'Khartoum',
    address: 'Al-Riyadh, Khartoum',
    phone: '+249 90 123 4567',
  ),
];

const List<Product> mockProducts = [
  Product(
    id: 'p1',
    name: 'Cisco Catalyst 2960-X 24-Port Switch',
    price: 850000,
    companyId: 'c1',
    companyName: 'Khartoum Tech Solutions',
    description:
        'Enterprise-class 24-port Gigabit Ethernet switch with 4x 1G SFP uplinks and LAN Base software for branch office and campus networking.',
    inStock: true,
    stockCount: 8,
    isInstallationAvailable: true,
    installationPrice: 45000,
    specifications: {
      'Model': 'WS-C2960X-24TS-L',
      'Ports': '24x 10/100/1000 Gigabit Ethernet',
      'Uplinks': '4x 1G SFP',
      'Form Factor': '1U Rack Mountable',
      'Warranty': '1 Year Official Hardware Warranty',
    },
  ),
  Product(
    id: 'p2',
    name: 'Cat6 UTP Network Cable Box (305m)',
    price: 125000,
    companyId: 'c3',
    companyName: 'Red Sea Networking Co.',
    description:
        'High-performance pure copper 24AWG Cat6 solid bulk cable, 305 meters, tested up to 550 MHz for reliable Gigabit networking.',
    inStock: true,
    stockCount: 25,
    isInstallationAvailable: false,
    specifications: {
      'Cable Type': 'Cat6 UTP Solid',
      'Conductor': '100% Pure Copper 24 AWG',
      'Length': '305 Meters (1000 ft)',
      'Bandwidth': 'Tested up to 550 MHz',
      'Color': 'Blue',
    },
  ),
  Product(
    id: 'p3',
    name: 'Dell PowerEdge T140 Tower Server',
    price: 2400000,
    companyId: 'c2',
    companyName: 'Nile IT & Cloud Systems',
    description:
        'Reliable, easy-to-manage entry-level tower server with Intel Xeon E-2224, 16GB ECC RAM, and 2TB Enterprise SATA HDD for growing businesses.',
    inStock: true,
    stockCount: 3,
    isInstallationAvailable: true,
    installationPrice: 120000,
    specifications: {
      'Processor': 'Intel Xeon E-2224 (4 cores, 3.4GHz, 8MB Cache)',
      'Memory': '16GB DDR4 ECC UDIMM',
      'Storage': '2TB 7.2K RPM SATA 3.5in Enterprise Hard Drive',
      'RAID Controller': 'PERC H330 Software RAID',
      'Power Supply': 'Single 365W Bronze Power Supply',
      'Warranty': '3 Years Next Business Day Onsite Warranty',
    },
  ),
  Product(
    id: 'p4',
    name: 'Ubiquiti UniFi U6 Pro Access Point',
    price: 310000,
    companyId: 'c1',
    companyName: 'Khartoum Tech Solutions',
    description:
        'High-performance WiFi 6 dual-band indoor AP with gigabit PoE support, capable of reaching up to 5.3 Gbps aggregate throughput.',
    inStock: true,
    stockCount: 14,
    isInstallationAvailable: true,
    installationPrice: 35000,
    specifications: {
      'WiFi Standard': 'WiFi 6 (802.11ax)',
      'Throughput': 'Up to 5.3 Gbps aggregate throughput',
      'MIMO': '4x4 MU-MIMO (5 GHz), 2x2 (2.4 GHz)',
      'Power Supply': '802.3at PoE+ (PoE injector not included)',
      'Coverage': '140 m² (1,500 ft²)',
    },
  ),
  Product(
    id: 'p5',
    name: 'Hikvision 4MP IP Network Dome Camera',
    price: 95000,
    companyId: 'c4',
    companyName: 'Blue Nile Technologies',
    description:
        '4 Megapixel outdoor IR fixed dome network security camera with H.265+ compression, 30m night vision, and IP67 weather resistance.',
    inStock: true,
    stockCount: 18,
    isInstallationAvailable: true,
    installationPrice: 25000,
    specifications: {
      'Resolution': '4 Megapixels (2560 × 1440)',
      'Lens': '2.8 mm fixed focal lens (98° FOV)',
      'Night Vision': 'IR Range up to 30 meters',
      'Protection': 'IP67 Weatherproof, IK10 Vandal-proof',
      'Compression': 'H.265+ / H.265 / H.264+ / H.264',
    },
  ),
  Product(
    id: 'p6',
    name: 'MikroTik RB4011iGS+RM Router',
    price: 420000,
    companyId: 'c3',
    companyName: 'Red Sea Networking Co.',
    description:
        'Powerful 10x Gigabit port router with Quad-core 1.4Ghz CPU, 1GB RAM, SFP+ 10Gbps cage, and matte black solid metal rackmount enclosure.',
    inStock: true,
    stockCount: 6,
    isInstallationAvailable: false,
    specifications: {
      'CPU': 'Quad-Core AL21400 1.4 GHz',
      'RAM': '1 GB',
      'Ethernet Ports': '10x Gigabit 10/100/1000 Mbps',
      'SFP+ Cage': '1x 10Gbps SFP+ port',
      'Enclosure': '1U Rackmount brackets included',
    },
  ),
];

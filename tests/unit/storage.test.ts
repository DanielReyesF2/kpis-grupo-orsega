/**
 * Tests unitarios para storage.ts
 * Prueba las operaciones básicas de DatabaseStorage
 *
 * NOTA: Estos tests usan mocks de la base de datos.
 * Para tests de integración reales con BD, ver tests/integration/
 */

import { MemStorage } from '../../server/storage';
import type { InsertUser, InsertCompany, InsertArea } from '@shared/schema';

describe('Storage Layer Tests', () => {
  describe('MemStorage (In-Memory Storage for Testing)', () => {
    let storage: MemStorage;

    beforeEach(() => {
      storage = new MemStorage();
    });

    describe('User Operations', () => {
      it('debe crear un usuario correctamente', async () => {
        const newUser: InsertUser = {
          name: 'Test User',
          email: 'test@example.com',
          password: '$2b$10$hashedpassword',
          role: 'viewer',
          companyId: 1,
          areaId: null
        };

        const created = await storage.createUser(newUser);

        expect(created.id).toBeDefined();
        expect(created.name).toBe(newUser.name);
        expect(created.email).toBe(newUser.email);
        expect(created.role).toBe(newUser.role);
      });

      it('debe obtener un usuario por ID', async () => {
        const newUser: InsertUser = {
          name: 'Test User',
          email: 'test@example.com',
          password: '$2b$10$hashedpassword',
          role: 'viewer',
          companyId: 1,
          areaId: null
        };

        const created = await storage.createUser(newUser);
        const retrieved = await storage.getUser(created.id);

        expect(retrieved).toBeDefined();
        expect(retrieved?.id).toBe(created.id);
        expect(retrieved?.email).toBe(newUser.email);
      });

      it('debe obtener un usuario por email', async () => {
        const newUser: InsertUser = {
          name: 'Test User',
          email: 'unique@example.com',
          password: '$2b$10$hashedpassword',
          role: 'viewer',
          companyId: 1,
          areaId: null
        };

        await storage.createUser(newUser);
        const retrieved = await storage.getUserByEmail('unique@example.com');

        expect(retrieved).toBeDefined();
        expect(retrieved?.email).toBe('unique@example.com');
      });

      it('debe obtener un usuario por username', async () => {
        const newUser: InsertUser = {
          name: 'Test User',
          email: 'testuser@example.com',
          password: '$2b$10$hashedpassword',
          role: 'viewer',
          companyId: 1,
          areaId: null
        };

        await storage.createUser(newUser);
        const retrieved = await storage.getUserByUsername('testuser@example.com');

        expect(retrieved).toBeDefined();
        expect(retrieved?.email).toBe('testuser@example.com');
      });

      it('debe actualizar un usuario', async () => {
        const newUser: InsertUser = {
          name: 'Test User',
          email: 'update@example.com',
          password: '$2b$10$hashedpassword',
          role: 'viewer',
          companyId: 1,
          areaId: null
        };

        const created = await storage.createUser(newUser);
        const updated = await storage.updateUser(created.id, { name: 'Updated Name' });

        expect(updated).toBeDefined();
        expect(updated?.name).toBe('Updated Name');
        expect(updated?.email).toBe('update@example.com');
      });

      it('debe listar todos los usuarios', async () => {
        const user1: InsertUser = {
          name: 'User 1',
          email: 'user1@example.com',
          password: '$2b$10$hashedpassword',
          role: 'viewer',
          companyId: 1,
          areaId: null
        };

        const user2: InsertUser = {
          name: 'User 2',
          email: 'user2@example.com',
          password: '$2b$10$hashedpassword',
          role: 'admin',
          companyId: 1,
          areaId: null
        };

        await storage.createUser(user1);
        await storage.createUser(user2);

        const users = await storage.getUsers();

        expect(users.length).toBeGreaterThanOrEqual(2);
      });

      it('debe eliminar un usuario', async () => {
        const newUser: InsertUser = {
          name: 'Delete Me',
          email: 'delete@example.com',
          password: '$2b$10$hashedpassword',
          role: 'viewer',
          companyId: 1,
          areaId: null
        };

        const created = await storage.createUser(newUser);
        const deleted = await storage.deleteUser(created.id);

        expect(deleted).toBe(true);

        const retrieved = await storage.getUser(created.id);
        expect(retrieved).toBeUndefined();
      });
    });

    describe('Company Operations', () => {
      it('debe crear una empresa correctamente', async () => {
        const newCompany: InsertCompany = {
          name: 'Test Company',
          description: 'A test company',
          sector: 'Technology',
          logo: null
        };

        const created = await storage.createCompany(newCompany);

        expect(created.id).toBeDefined();
        expect(created.name).toBe(newCompany.name);
        expect(created.description).toBe(newCompany.description);
      });

      it('debe obtener una empresa por ID', async () => {
        const newCompany: InsertCompany = {
          name: 'Test Company',
          description: 'A test company',
          sector: 'Technology',
          logo: null
        };

        const created = await storage.createCompany(newCompany);
        const retrieved = await storage.getCompany(created.id);

        expect(retrieved).toBeDefined();
        expect(retrieved?.id).toBe(created.id);
        expect(retrieved?.name).toBe(newCompany.name);
      });

      it('debe listar todas las empresas', async () => {
        const company1: InsertCompany = {
          name: 'Company 1',
          description: 'First company',
          sector: 'Tech',
          logo: null
        };

        const company2: InsertCompany = {
          name: 'Company 2',
          description: 'Second company',
          sector: 'Finance',
          logo: null
        };

        await storage.createCompany(company1);
        await storage.createCompany(company2);

        const companies = await storage.getCompanies();

        expect(companies.length).toBeGreaterThanOrEqual(2);
      });

      it('debe actualizar una empresa', async () => {
        const newCompany: InsertCompany = {
          name: 'Original Name',
          description: 'Original description',
          sector: 'Tech',
          logo: null
        };

        const created = await storage.createCompany(newCompany);
        const updated = await storage.updateCompany(created.id, {
          name: 'Updated Name',
          description: 'Updated description'
        });

        expect(updated).toBeDefined();
        expect(updated?.name).toBe('Updated Name');
        expect(updated?.description).toBe('Updated description');
      });
    });

    describe('Area Operations', () => {
      it('debe crear un área correctamente', async () => {
        // Primero crear una empresa
        const company = await storage.createCompany({
          name: 'Test Company',
          description: null,
          sector: null,
          logo: null
        });

        const newArea: InsertArea = {
          name: 'Ventas',
          description: 'Área de ventas',
          companyId: company.id
        };

        const created = await storage.createArea(newArea);

        expect(created.id).toBeDefined();
        expect(created.name).toBe(newArea.name);
        expect(created.companyId).toBe(company.id);
      });

      it('debe obtener un área por ID', async () => {
        const company = await storage.createCompany({
          name: 'Test Company',
          description: null,
          sector: null,
          logo: null
        });

        const newArea: InsertArea = {
          name: 'Marketing',
          description: 'Área de marketing',
          companyId: company.id
        };

        const created = await storage.createArea(newArea);
        const retrieved = await storage.getArea(created.id);

        expect(retrieved).toBeDefined();
        expect(retrieved?.id).toBe(created.id);
        expect(retrieved?.name).toBe(newArea.name);
      });

      it('debe obtener áreas por empresa', async () => {
        const company = await storage.createCompany({
          name: 'Test Company',
          description: null,
          sector: null,
          logo: null
        });

        await storage.createArea({
          name: 'Area 1',
          description: 'First area',
          companyId: company.id
        });

        await storage.createArea({
          name: 'Area 2',
          description: 'Second area',
          companyId: company.id
        });

        const areas = await storage.getAreasByCompany(company.id);

        expect(areas.length).toBe(2);
        expect(areas.every(a => a.companyId === company.id)).toBe(true);
      });
    });
  });

  describe('Storage Interface Contracts', () => {
    it('debe implementar todas las interfaces requeridas', () => {
      const storage = new MemStorage();

      // User operations
      expect(typeof storage.getUser).toBe('function');
      expect(typeof storage.getUserByEmail).toBe('function');
      expect(typeof storage.getUserByUsername).toBe('function');
      expect(typeof storage.createUser).toBe('function');
      expect(typeof storage.updateUser).toBe('function');
      expect(typeof storage.getUsers).toBe('function');
      expect(typeof storage.deleteUser).toBe('function');

      // Company operations
      expect(typeof storage.getCompany).toBe('function');
      expect(typeof storage.getCompanies).toBe('function');
      expect(typeof storage.createCompany).toBe('function');
      expect(typeof storage.updateCompany).toBe('function');

      // Area operations
      expect(typeof storage.getArea).toBe('function');
      expect(typeof storage.getAreas).toBe('function');
      expect(typeof storage.getAreasByCompany).toBe('function');
      expect(typeof storage.createArea).toBe('function');
      expect(typeof storage.updateArea).toBe('function');

      // KPI operations
      expect(typeof storage.getKpi).toBe('function');
      expect(typeof storage.getKpis).toBe('function');
      expect(typeof storage.createKpi).toBe('function');
      expect(typeof storage.updateKpi).toBe('function');

      // Shipment operations
      expect(typeof storage.getShipment).toBe('function');
      expect(typeof storage.getShipments).toBe('function');
      expect(typeof storage.createShipment).toBe('function');
      expect(typeof storage.updateShipment).toBe('function');

      // Client operations
      expect(typeof storage.getClient).toBe('function');
      expect(typeof storage.getClients).toBe('function');
      expect(typeof storage.createClient).toBe('function');

      // Payment Voucher operations
      expect(typeof storage.getPaymentVoucher).toBe('function');
      expect(typeof storage.getPaymentVouchers).toBe('function');
      expect(typeof storage.createPaymentVoucher).toBe('function');
      expect(typeof storage.updatePaymentVoucher).toBe('function');
    });
  });
});

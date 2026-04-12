const request = require('supertest');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

describe('Auth Routes', () => {
    let app;
    
    beforeAll(() => {
        app = require('../server.js');
    });

    test('Signup should hash password and create user', async () => {
        const res = await request(app)
            .post('/api/auth/signup')
            .send({
                email: 'test@example.com',
                password: 'secure123',
                companyName: 'Test Company'
            });
        
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
    });

    test('Login should return JWT tokens', async () => {
        // First signup
        await request(app)
            .post('/api/auth/signup')
            .send({
                email: 'login-test@example.com',
                password: 'secure123',
                companyName: 'Test Company'
            });

        // Then login
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'login-test@example.com',
                password: 'secure123'
            });
        
        expect(res.status).toBe(200);
        expect(res.body.accessToken).toBeDefined();
        expect(res.body.refreshToken).toBeDefined();
    });

    test('Login with wrong password should fail', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'test@example.com',
                password: 'wrongpassword'
            });
        
        expect(res.status).toBe(401);
    });
});
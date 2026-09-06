import { mapMerchantToCategory, suggestCategories } from '../merchant-mapper';
import { describe, it, expect } from 'vitest';

describe('Merchant Mapper', () => {
  describe('mapMerchantToCategory', () => {
    it('should map restaurant merchants to Alimentação', () => {
      expect(mapMerchantToCategory('Restaurante da Silva')).toBe('Alimentação');
      expect(mapMerchantToCategory('Pizza Hut')).toBe('Alimentação');
      expect(mapMerchantToCategory('Churrascaria XYZ')).toBe('Alimentação');
    });

    it('should map uber to Transporte', () => {
      expect(mapMerchantToCategory('Uber Brasil')).toBe('Transporte');
      expect(mapMerchantToCategory('UBER TRIP')).toBe('Transporte');
    });

    it('should map gas stations to Transporte', () => {
      expect(mapMerchantToCategory('Posto Shell')).toBe('Transporte');
      expect(mapMerchantToCategory('BR Distribuidora')).toBe('Transporte');
    });

    it('should map pharmacy to Saúde', () => {
      expect(mapMerchantToCategory('Farmácia do Bairro')).toBe('Saúde');
      expect(mapMerchantToCategory('Drogaria Araçá')).toBe('Saúde');
    });

    it('should map streaming services to Lazer', () => {
      expect(mapMerchantToCategory('Netflix')).toBe('Lazer');
      expect(mapMerchantToCategory('Spotify')).toBe('Lazer');
      expect(mapMerchantToCategory('Disney Plus')).toBe('Lazer');
    });

    it('should map utilities to Moradia', () => {
      expect(mapMerchantToCategory('SABESP - Água')).toBe('Moradia');
      expect(mapMerchantToCategory('Energia Elétrica')).toBe('Moradia');
      expect(mapMerchantToCategory('Internet Vivo')).toBe('Moradia');
    });

    it('should return Outros as fallback', () => {
      expect(mapMerchantToCategory('Comerciante Desconhecido XYZ')).toBe('Outros');
      expect(mapMerchantToCategory('????')).toBe('Outros');
    });

    it('should be case insensitive', () => {
      expect(mapMerchantToCategory('UBER BRASIL')).toBe('Transporte');
      expect(mapMerchantToCategory('netflix')).toBe('Lazer');
    });
  });

  describe('suggestCategories', () => {
    it('should suggest categories in order of confidence', () => {
      const suggestions = suggestCategories('Restaurante');
      expect(suggestions[0].category).toBe('Alimentação');
      expect(suggestions[0].confidence).toBeGreaterThan(0.5);
    });

    it('should limit suggestions to specified count', () => {
      const suggestions = suggestCategories('Transporte', 2);
      expect(suggestions.length).toBeLessThanOrEqual(2);
    });

    it('should handle empty merchant', () => {
      const suggestions = suggestCategories('');
      expect(Array.isArray(suggestions)).toBe(true);
    });
  });
});

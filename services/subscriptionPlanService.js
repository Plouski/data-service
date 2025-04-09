// database-service/services/subscriptionPlansService.js
const logger = require('../utils/logger');

/**
 * Service de gestion des plans d'abonnement
 * Définit et gère les différents plans, leurs prix et fonctionnalités
 */
class SubscriptionPlansService {
  constructor() {
    // Configuration des plans d'abonnement
    this.plans = {
      free: {
        name: 'Gratuit',
        description: 'Découvrez les fonctionnalités de base de ROADTRIP!',
        price: {
          EUR: 0,
          USD: 0,
          GBP: 0,
          CAD: 0
        },
        billing: 'monthly',
        stripePriceIds: {
          EUR: null, // Plan gratuit, pas d'ID Stripe
          USD: null,
          GBP: null,
          CAD: null
        },
        features: {
          maxTrips: 3,
          aiConsultations: 1,
          customization: false,
          maxCollaborators: 0,
          exportFormats: ['pdf'],
          prioritySupport: false,
          offlineAccess: false,
          advertisingFree: false
        },
        highlight: false,
        order: 1
      },
      standard: {
        name: 'Standard',
        description: 'Idéal pour les voyageurs occasionnels',
        price: {
          EUR: 9.99,
          USD: 11.99,
          GBP: 8.99,
          CAD: 15.99
        },
        billing: 'monthly',
        stripePriceIds: {
          EUR: 'price_standard_eur_monthly',
          USD: 'price_standard_usd_monthly',
          GBP: 'price_standard_gbp_monthly',
          CAD: 'price_standard_cad_monthly'
        },
        features: {
          maxTrips: 10,
          aiConsultations: 5,
          customization: false,
          maxCollaborators: 1,
          exportFormats: ['pdf', 'csv'],
          prioritySupport: false,
          offlineAccess: false,
          advertisingFree: true
        },
        highlight: false,
        order: 2
      },
      premium: {
        name: 'Premium',
        description: 'Pour les globe-trotters passionnés',
        price: {
          EUR: 19.99,
          USD: 22.99,
          GBP: 17.99,
          CAD: 29.99
        },
        billing: 'monthly',
        stripePriceIds: {
          EUR: 'price_premium_eur_monthly',
          USD: 'price_premium_usd_monthly',
          GBP: 'price_premium_gbp_monthly',
          CAD: 'price_premium_cad_monthly'
        },
        features: {
          maxTrips: 50,
          aiConsultations: 20,
          customization: true,
          maxCollaborators: 5,
          exportFormats: ['pdf', 'csv', 'excel', 'gpx'],
          prioritySupport: true,
          offlineAccess: true,
          advertisingFree: true
        },
        highlight: true,
        order: 3
      },
      enterprise: {
        name: 'Enterprise',
        description: 'Solution idéale pour les agences de voyage',
        price: {
          EUR: 49.99,
          USD: 54.99,
          GBP: 44.99,
          CAD: 69.99
        },
        billing: 'monthly',
        stripePriceIds: {
          EUR: 'price_enterprise_eur_monthly',
          USD: 'price_enterprise_usd_monthly',
          GBP: 'price_enterprise_gbp_monthly',
          CAD: 'price_enterprise_cad_monthly'
        },
        features: {
          maxTrips: 1000,
          aiConsultations: 100,
          customization: true,
          maxCollaborators: 20,
          exportFormats: ['pdf', 'csv', 'excel', 'gpx'],
          prioritySupport: true,
          offlineAccess: true,
          advertisingFree: true
        },
        highlight: false,
        order: 4
      }
    };
    
    // Plans d'abonnement annuels (avec réduction)
    this.yearlyPlans = {
      standard_yearly: {
        name: 'Standard (Annuel)',
        description: 'Idéal pour les voyageurs occasionnels - Économisez avec l\'abonnement annuel',
        price: {
          EUR: 99.99, // ~17% de réduction
          USD: 119.99,
          GBP: 89.99,
          CAD: 159.99
        },
        billing: 'yearly',
        stripePriceIds: {
          EUR: 'price_standard_eur_yearly',
          USD: 'price_standard_usd_yearly',
          GBP: 'price_standard_gbp_yearly',
          CAD: 'price_standard_cad_yearly'
        },
        features: {
          ...this.plans.standard.features
        },
        baseMonthlyPlan: 'standard',
        order: 2.5
      },
      premium_yearly: {
        name: 'Premium (Annuel)',
        description: 'Pour les globe-trotters passionnés - Économisez avec l\'abonnement annuel',
        price: {
          EUR: 199.99, // ~17% de réduction
          USD: 229.99,
          GBP: 179.99,
          CAD: 299.99
        },
        billing: 'yearly',
        stripePriceIds: {
          EUR: 'price_premium_eur_yearly',
          USD: 'price_premium_usd_yearly',
          GBP: 'price_premium_gbp_yearly',
          CAD: 'price_premium_cad_yearly'
        },
        features: {
          ...this.plans.premium.features
        },
        baseMonthlyPlan: 'premium',
        highlight: true,
        order: 3.5
      },
      enterprise_yearly: {
        name: 'Enterprise (Annuel)',
        description: 'Solution idéale pour les agences de voyage - Économisez avec l\'abonnement annuel',
        price: {
          EUR: 499.99, // ~17% de réduction
          USD: 549.99,
          GBP: 449.99,
          CAD: 699.99
        },
        billing: 'yearly',
        stripePriceIds: {
          EUR: 'price_enterprise_eur_yearly',
          USD: 'price_enterprise_usd_yearly',
          GBP: 'price_enterprise_gbp_yearly',
          CAD: 'price_enterprise_cad_yearly'
        },
        features: {
          ...this.plans.enterprise.features
        },
        baseMonthlyPlan: 'enterprise',
        order: 4.5
      }
    };
    
    // En production, on irait chercher les vrais IDs Stripe dans les variables d'environnement
    if (process.env.NODE_ENV === 'production') {
      try {
        this.loadProductionPriceIds();
      } catch (error) {
        logger.error('Erreur lors du chargement des IDs de prix Stripe', error);
      }
    }
  }
  
  /**
   * Charger les IDs de prix réels depuis les variables d'environnement
   */
  loadProductionPriceIds() {
    // Standard
    this.plans.standard.stripePriceIds.EUR = process.env.STRIPE_PRICE_STANDARD_EUR_MONTHLY;
    this.plans.standard.stripePriceIds.USD = process.env.STRIPE_PRICE_STANDARD_USD_MONTHLY;
    this.plans.standard.stripePriceIds.GBP = process.env.STRIPE_PRICE_STANDARD_GBP_MONTHLY;
    this.plans.standard.stripePriceIds.CAD = process.env.STRIPE_PRICE_STANDARD_CAD_MONTHLY;
    
    // Premium
    this.plans.premium.stripePriceIds.EUR = process.env.STRIPE_PRICE_PREMIUM_EUR_MONTHLY;
    this.plans.premium.stripePriceIds.USD = process.env.STRIPE_PRICE_PREMIUM_USD_MONTHLY;
    this.plans.premium.stripePriceIds.GBP = process.env.STRIPE_PRICE_PREMIUM_GBP_MONTHLY;
    this.plans.premium.stripePriceIds.CAD = process.env.STRIPE_PRICE_PREMIUM_CAD_MONTHLY;
    
    // Enterprise
    this.plans.enterprise.stripePriceIds.EUR = process.env.STRIPE_PRICE_ENTERPRISE_EUR_MONTHLY;
    this.plans.enterprise.stripePriceIds.USD = process.env.STRIPE_PRICE_ENTERPRISE_USD_MONTHLY;
    this.plans.enterprise.stripePriceIds.GBP = process.env.STRIPE_PRICE_ENTERPRISE_GBP_MONTHLY;
    this.plans.enterprise.stripePriceIds.CAD = process.env.STRIPE_PRICE_ENTERPRISE_CAD_MONTHLY;
    
    // Annuels
    this.yearlyPlans.standard_yearly.stripePriceIds.EUR = process.env.STRIPE_PRICE_STANDARD_EUR_YEARLY;
    this.yearlyPlans.premium_yearly.stripePriceIds.EUR = process.env.STRIPE_PRICE_PREMIUM_EUR_YEARLY;
    this.yearlyPlans.enterprise_yearly.stripePriceIds.EUR = process.env.STRIPE_PRICE_ENTERPRISE_EUR_YEARLY;
  }
  
  /**
   * Récupérer tous les plans d'abonnement
   * @param {string} currency - Devise (EUR, USD, etc.)
   * @param {boolean} includeYearly - Inclure les plans annuels
   * @returns {Object} Plans d'abonnement
   */
  getAllPlans(currency = 'EUR', includeYearly = true) {
    const allPlans = { ...this.plans };
    
    if (includeYearly) {
      Object.assign(allPlans, this.yearlyPlans);
    }
    
    // Formater et trier les plans
    const formattedPlans = Object.entries(allPlans).map(([id, plan]) => ({
      id,
      name: plan.name,
      description: plan.description,
      price: plan.price[currency] || plan.price.EUR,
      currency,
      billing: plan.billing || 'monthly',
      stripePriceId: plan.stripePriceIds[currency] || plan.stripePriceIds.EUR,
      features: plan.features,
      highlight: plan.highlight || false,
      order: plan.order || 99
    })).sort((a, b) => a.order - b.order);
    
    return formattedPlans;
  }
  
  /**
   * Récupérer un plan d'abonnement spécifique
   * @param {string} planId - Identifiant du plan
   * @param {string} currency - Devise (EUR, USD, etc.)
   * @returns {Object} Détails du plan
   */
  getPlanDetails(planId, currency = 'EUR') {
    const plan = this.plans[planId] || this.yearlyPlans[planId];
    
    if (!plan) {
      throw new Error(`Plan d'abonnement non trouvé: ${planId}`);
    }
    
    return {
      id: planId,
      name: plan.name,
      description: plan.description,
      price: plan.price[currency] || plan.price.EUR,
      currency,
      billing: plan.billing || 'monthly',
      stripePriceId: plan.stripePriceIds[currency] || plan.stripePriceIds.EUR,
      features: plan.features,
      highlight: plan.highlight || false
    };
  }
  
  /**
   * Récupérer le plan associé à un prix Stripe
   * @param {string} stripePriceId - ID du prix Stripe
   * @returns {Object} Plan d'abonnement
   */
  getPlanFromStripePrice(stripePriceId) {
    // Rechercher dans les plans mensuels
    for (const [planId, plan] of Object.entries(this.plans)) {
      for (const priceId of Object.values(plan.stripePriceIds)) {
        if (priceId === stripePriceId) {
          return { id: planId, ...plan };
        }
      }
    }
    
    // Rechercher dans les plans annuels
    for (const [planId, plan] of Object.entries(this.yearlyPlans)) {
      for (const priceId of Object.values(plan.stripePriceIds)) {
        if (priceId === stripePriceId) {
          return { id: planId, ...plan };
        }
      }
    }
    
    // Plan non trouvé
    logger.warn(`Aucun plan trouvé pour l'ID Stripe: ${stripePriceId}`);
    return null;
  }
  
  /**
   * Comparer deux plans d'abonnement
   * @param {string} currentPlanId - ID du plan actuel
   * @param {string} newPlanId - ID du nouveau plan
   * @returns {Object} Différences entre les plans
   */
  comparePlans(currentPlanId, newPlanId) {
    const currentPlan = this.plans[currentPlanId] || this.yearlyPlans[currentPlanId] || this.plans.free;
    const newPlan = this.plans[newPlanId] || this.yearlyPlans[newPlanId] || this.plans.free;
    
    if (!currentPlan || !newPlan) {
      throw new Error('Plan d\'abonnement invalide');
    }
    
    // Comparer les fonctionnalités
    const differences = {};
    const features = [
      'maxTrips', 'aiConsultations', 'customization', 'maxCollaborators',
      'exportFormats', 'prioritySupport', 'offlineAccess', 'advertisingFree'
    ];
    
    features.forEach(feature => {
      const currentValue = currentPlan.features[feature];
      const newValue = newPlan.features[feature];
      
      if (JSON.stringify(currentValue) !== JSON.stringify(newValue)) {
        differences[feature] = {
          from: currentValue,
          to: newValue,
          change: Array.isArray(newValue) 
            ? `${newValue.length - currentValue.length} format(s) supplémentaire(s)`
            : typeof newValue === 'boolean'
              ? newValue ? 'Activé' : 'Désactivé'
              : `${newValue - currentValue > 0 ? '+' : ''}${newValue - currentValue}`
        };
      }
    });
    
    // Déterminer si c'est une amélioration ou une rétrogradation
    const isUpgrade = newPlan.order > currentPlan.order;
    
    return {
      isUpgrade,
      differences
    };
  }
}

// Exporter une instance unique
module.exports = new SubscriptionPlansService();
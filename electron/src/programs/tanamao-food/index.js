import TanamaoFoodController from './controller.js';
import initTanamaoFoodApi from './api.js';

export default {
    metadata: {
        id: 'tanamao-food',
        name: 'Tanamao Food',
        icon: 'restaurant',
        type: 'app',
        description: 'Sistema de gestão de delivery e restaurantes.',
        dependencies: ['postgresql', 'postgis']
    },
    controller: TanamaoFoodController,
    initApi: initTanamaoFoodApi
};

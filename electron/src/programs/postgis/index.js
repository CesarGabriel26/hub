import PostgisController from './controller.js';

export default {
    metadata: {
        id: 'postgis',
        name: 'PostGIS',
        icon: 'map',
        type: 'addin',
        description: 'Extensão espacial para PostgreSQL.',
        dependencies: ['postgresql']
    },
    controller: PostgisController,
    initApi: () => { }
};

import PostgresController from './controller.js';
import initPostgresApi from './api.js';

export default {
    metadata: {
        id: 'postgresql',
        name: 'PostgreSQL',
        icon: 'storage',
        type: 'service',
        description: 'Serviço de banco de dados (v17).',
        port: 5433,
        dependencies: []
    },
    controller: PostgresController,
    initApi: initPostgresApi
};

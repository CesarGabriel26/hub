import { info, warn, error } from '../utils/logger.js';

/**
 * ProgramManager
 * Centralizes the management of all programs and services in the Hub.
 */
class ProgramManager {
    constructor() {
        this.programs = new Map();
        this.controllers = new Map();
    }

    /**
     * Registers a program and its controller.
     * @param {Object} metadata - Program metadata (id, name, type, icon, dependencies, etc.)
     * @param {Object} controller - The controller instance for this program.
     */
    register(metadata, controller) {
        const { id } = metadata;
        if (this.programs.has(id)) {
            warn('ProgramManager', `Program ${id} is already registered. Overwriting.`);
        }
        
        // Ensure controller has required methods or provides defaults
        this.programs.set(id, metadata);
        this.controllers.set(id, controller);
        
        info('ProgramManager', `Registered program: ${id} (${metadata.name})`);
    }

    /**
     * Retrieves all registered programs with their current status.
     */
    getProgramsWithStatus() {
        return Array.from(this.programs.values()).map(metadata => {
            const controller = this.controllers.get(metadata.id);
            const status = controller && typeof controller.getStatus === 'function' 
                ? controller.getStatus() 
                : { status: 'not-installed', isRunning: false };

            return {
                ...metadata,
                ...status
            };
        });
    }

    getProgramMetadata(id) {
        return this.programs.get(id);
    }

    getController(id) {
        return this.controllers.get(id);
    }

    /**
     * Returns all programs of a specific type.
     */
    getProgramsByType(type) {
        return Array.from(this.programs.values()).filter(p => p.type === type);
    }
}

export default new ProgramManager();

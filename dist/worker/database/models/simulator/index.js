"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimulatorRun = exports.SimulatorConfig = void 0;
var simulator_config_model_1 = require("./simulator-config.model");
Object.defineProperty(exports, "SimulatorConfig", { enumerable: true, get: function () { return __importDefault(simulator_config_model_1).default; } });
var simulator_run_model_1 = require("./simulator-run.model");
Object.defineProperty(exports, "SimulatorRun", { enumerable: true, get: function () { return __importDefault(simulator_run_model_1).default; } });

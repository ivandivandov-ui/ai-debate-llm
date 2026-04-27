// ============================================================
// Точка входа фреймворка Debate Engine
// Все публичные API сгруппированы по доменам.
// ============================================================

// ---------------------- Версия библиотеки ----------------------
// eslint-disable-next-line @typescript-eslint/no-var-requires
let _version = "1.0.0";
try { _version = require("../package.json").version; } catch { /* fallback */ }
export const VERSION = _version;

// ---------------------- Ядро: контракты и сообщения ----------------------
// Типы сообщений и идентификаторов
export type {
  A2AMessage,
  AgentId,
  SessionId,
  MessageId,
  AgentRole,
  MessageType,
  MessageStatus,
  MessageMetadata,
  A2AEnvelope
} from "./core/contracts/message";

// Фабрики сообщений (значения)
export { createMessage } from "./core/contracts/message";

// Типы запросов
export type {
  DebateRequest,
  RequestMetadata,
  RequestPreferences
} from "./core/contracts/request";

// Типы задач
export type {
  Task,
  TaskType,
  TaskResult,
  TaskMetrics,
  TaskConstraints,
  UncertaintyInfo,
  UncertaintySource
} from "./core/contracts/task";

// Типы результатов и рассуждений
export type {
  DebateResult,
  Evidence,
  ReasoningChain,
  ReasoningStep,
  Alternative,
  ResultMetrics
} from "./core/contracts/result";

// Типы ответов и ошибок
export type {
  DebateResponse,
  DebateResultData,
  ErrorResponse,
  ErrorCode,
  ResponseMetadata
} from "./core/contracts/response";

// ---------------------- Ядро: состояние и конвейер ----------------------
// Типы состояния конвейера
export type {
  PipelineState,
  PipelineStage,
  HistoryEntry,
  VerificationState,
  VerificationItem,
  SynthesisState,
  SynthesisCandidate,
  SynthesisResult as PipelineStateSynthesisResult,
  PipelineUncertainty
} from "./core/contracts/state";

// Фабрика начального состояния (значение)
export { createInitialState } from "./core/contracts/state";

// Явный type‑экспорт алиаса Pipeline (было значение → теперь корректно)
export type { PipelineState as Pipeline } from "./core/contracts/state";

// Ядро движка и глобальный реестр (значения)
export { DebateEngine, createEngine } from "./core/engine";
export { GlobalRegistry } from "./core/global-registry";

// Этапы конвейера (классы, значения)
export {
  InputStage,
  DecomposeStage,
  DispatchStage,
  CollectStage,
  VerifyStage,
  DecisionStage,
  FuseStage,
  StoreStage,
  OutputStage
} from "./core/pipeline";

// Промпты (значения)
export { prompts, getPrompt } from "./core/pipeline/prompts";

// Типы для отдельных этапов конвейера
export type { StopCondition, UncertaintyScore, DecisionMetrics } from "./core/pipeline/decision";
// Экспорт VerificationResult из verify с алиасом, чтобы избежать конфликта с верификатором
export type { VerificationResult as PipelineVerificationResult } from "./core/pipeline/verify";
export type { FuseResult } from "./core/pipeline/fuse";

// Рантайм: построитель графа, узлы, разрешение рёбер, чекпоинты
export { GraphBuilder, createGraphBuilder } from "./core/runtime/graph-builder";
export { NodeRegistry, createNode, executeWithRetry } from "./core/runtime/node-registry";
export { EdgeResolver, createEdgeResolver } from "./core/runtime/edge-resolver";
export { CheckpointManager, createCheckpointManager } from "./core/runtime/checkpoint";
export { CustomPipelineExecutor, createExecutor } from "./core/runtime/executor";

// ---------------------- Агенты ----------------------
// Интерфейс и конфигурация агентов (типы)
export type {
  IAgent,
  AgentConfig,
  AgentInput,
  AgentOutput,
  AgentMessage,
  CognitiveModel,
  AgentCapabilities,
  AgentSnapshot,
  AgentFactory,
  AgentRegistry
} from "./agents/base/agent.interface";

// Состояние агента (типы и функции)
export type {
  AgentState,
  AgentLifecycleState,
  AgentContext,
  AgentMessage as AgentHistoryMessage,
  AgentMemory,
  AgentMetrics,
  AgentBelief,
  UncertaintyTracking
} from "./agents/base/agent-state";

export {
  createAgentState,
  transitionState,
  addBelief,
  updateUncertainty,
  STATE_TRANSITIONS
} from "./agents/base/agent-state";

// Фабрика и раннер агентов
export { createAgentFactory, DefaultAgentFactory } from "./agents/base/agent-factory";
export { AgentRunner } from "./agents/base/agent-runner";

// Ролевые агенты
export { BuilderAgent } from "./agents/roles/builder.agent";
export { CriticAgent } from "./agents/roles/critic.agent";
export { SkepticAgent } from "./agents/roles/skeptic.agent";
export { ScientistAgent } from "./agents/roles/scientist.agent";
export { VerifierAgent } from "./agents/roles/verifier.agent";

// Когнитивные агенты
export { FastThinkingAgent } from "./agents/cognitive/fast-thinking.agent";
export { SlowReasoningAgent } from "./agents/cognitive/slow-reasoning.agent";
export { CreativeAgent } from "./agents/cognitive/creative.agent";

// ---------------------- Коммуникация агентов ----------------------
export { A2AProtocol } from "./agents/communication/protocol";
// Типы протокола (TurnDecision отсутствует в этом модуле — убран)
export type {
  A2APolicy,
  TurnLimitConfig,
  CostGuardConfig,
  RoleAccessConfig,
  ProtocolRules,
  RoutingRule
} from "./agents/communication/protocol";

export { MessageBus } from "./agents/communication/message-bus";
export type { MessageDelivery } from "./agents/communication/message-bus";

export { A2ARouter } from "./agents/communication/router";
// RoutingContext переименован, чтобы не пересекаться с провайдерским
export type {
  RoutingTarget,
  RoutingContext as CommunicationRoutingContext,  // ← алиас
  RoutingStrategy,
  RouterConfig
} from "./agents/communication/router";

// ---------------------- Инструменты агентов ----------------------
export type {
  Tool,
  ToolSchema,
  ToolCall,
  ToolResult,
  ToolContext,
  IToolRegistry,
  IToolExecutor
} from "./agents/tools/tool.interface";

export {
  ToolRegistry,
  createTool,
  createStringTool,
  createObjectTool
} from "./agents/tools/tool-registry";

export { ToolExecutor, createToolExecutor } from "./agents/tools/executor";
export type { ToolAdapter } from "./agents/tools/executor";

// Адаптеры инструментов (поиск, код)
export { createSearchTool, SearchToolAdapter, searchTool } from "./agents/tools/adapters/search.tool";
export { createCodeTool, CodeToolAdapter, executeCode } from "./agents/tools/adapters/code.tool";

// ---------------------- Провайдеры LLM ----------------------
export type {
  Provider,
  ProviderMessage,
  ProviderOptions,
  ProviderResponse,
  ProviderStreamChunk,
  ProviderUsage,
  ProviderModel,
  ProviderPricing,
  ProviderTool,
  IProviderRouter,
  RoutingContext as ProviderRoutingContext  // ← алиас для устранения конфликта
} from "./providers/base/provider.interface";

export { GoogleProvider } from "./providers/google/gemini.provider";
export { OpenRouterProvider } from "./providers/openrouter/openrouter.provider";
export { AnthropicProvider } from "./providers/anthropic/anthropic.provider";
export { OpenAIProvider } from "./providers/openai/openai.provider";
export { ProviderRouter, LoadBalancer, createProviderRouter } from "./providers/router/provider-router";

// ---------------------- Протоколы дебатов ----------------------
export type {
  DebateProtocol,
  ProtocolState,
  ProtocolPhase,
  TurnRecord,
  TurnAction,
  Proposal,
  ProtocolParticipant,
  Position,
  TurnDecision,          // этот TurnDecision из протоколов дебатов
  ProtocolConfig
} from "./protocols/base/protocol.interface";

export {
  SocraticProtocol,
  AdversarialProtocol,
  RedTeamProtocol,
  ConsensusProtocol,
  ProtocolRegistry
} from "./protocols/implementation";

// ---------------------- Верификация ----------------------
// Используем оригинальное имя VerificationResult из верификатора (конфликт с pipeline устранён алиасом выше)
export type {
  VerificationResult,
  FactualVerifier,
  LogicalVerifier,
  ConsistencyVerifier,
  SafetyVerifier
} from "./verification/verifier";
export { VerifierFactory } from "./verification/verifier";

// ---------------------- Синтез ----------------------
export type { SynthesisResult, SynthesisStrategy, SynthesisOptions } from "./synthesis/strategies/synthesis";
export { SynthesisEngine, createSynthesisEngine } from "./synthesis/strategies/synthesis";

// ---------------------- Память ----------------------
export type { LongTermMemoryConfig } from "./memory/long-term";
export { longTermMemory } from "./memory/long-term";
// MemoryEntry объявлен в short-term и используется в long-term через импорт
export type { MemoryEntry as LongTermEntry } from "./memory/short-term";

// Кратковременная память
export {
  shortTermMemory,
  getSessionMemory,
  setSessionMemory,
  type MemoryStore
} from "./memory/short-term";

// ---------------------- Оркестрация дебатов ----------------------
export { DebateOrchestrator } from "./orchestration/debate-orchestrator";
export type { DebateOrchestratorConfig } from "./orchestration/debate-orchestrator";

// ---------------------- Наблюдаемость ----------------------
export type { LogEntry } from "./observability/logging/index";
export { logger } from "./observability/logging/index";

export { MetricsCollector, metrics } from "./observability/metrics";
export type { Metrics } from "./observability/metrics";

export { Tracer, debugger_ } from "./observability/tracing";
export type { TraceSpan, DebugConfig } from "./observability/tracing";

// ---------------------- Утилиты ----------------------
// Ограничение скорости, кэш
export { RateLimiter, createRateLimiter } from "./utils/rate-limiter";
export { Cache, createCache, queryCache } from "./utils/cache";

// Работа с противоречиями
export { isContradiction, hasContradictions, findContradictions } from "./utils/contradictions";

// Повторные попытки
export { withRetry, defaultRetryConfig } from "./utils/retry";
export type { RetryConfig } from "./utils/retry";

// Идентификаторы
export { generateSessionId, generateTaskId, isValidSessionId } from "./utils/ids";

// Ценообразование
export { calculateCost, defaultPricing, type ModelPricing } from "./providers/pricing";

// Обработка ошибок
export type {
  DebateError,
  ProviderError,
  TimeoutError,
  ValidationError,
  NotFoundError,
  RateLimitError
} from "./utils/errors";
export { isDebateError, formatError, withErrorHandling } from "./utils/errors";

// Валидация
export { Validator, required, minLength, maxLength } from "./utils/validation";

// Хелперы
export {
  EventEmitter,
  globalEvents,
  debounce,
  throttle,
  timeout,
  chunk,
  unique,
  groupBy,
} from "./utils/helpers";
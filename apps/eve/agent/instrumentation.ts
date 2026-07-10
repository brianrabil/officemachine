import { SEMRESATTRS_PROJECT_NAME } from "@arizeai/openinference-semantic-conventions";
import {
  isOpenInferenceSpan,
  OpenInferenceSimpleSpanProcessor,
} from "@arizeai/openinference-vercel";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { registerOTel } from "@vercel/otel";
import { defineInstrumentation } from "eve/instrumentation";

export default defineInstrumentation({
  setup: ({ agentName }) => {
    const endpoint = process.env.PHOENIX_COLLECTOR_ENDPOINT;

    if (!endpoint) {
      console.warn("PHOENIX_COLLECTOR_ENDPOINT not set — skipping Phoenix tracing");
      return;
    }

    const projectName = process.env.PHOENIX_PROJECT_NAME ?? agentName;

    return registerOTel({
      serviceName: projectName,
      attributes: { [SEMRESATTRS_PROJECT_NAME]: projectName },
      spanProcessors: [
        new OpenInferenceSimpleSpanProcessor({
          exporter: new OTLPTraceExporter({
            url: `${endpoint}/v1/traces`,
            headers: process.env.PHOENIX_API_KEY
              ? { Authorization: `Bearer ${process.env.PHOENIX_API_KEY}` }
              : undefined,
          }),
          spanFilter: isOpenInferenceSpan,
          reparentOrphanedSpans: true,
        }),
      ],
    });
  },
});

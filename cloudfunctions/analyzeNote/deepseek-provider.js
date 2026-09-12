const https = require("https");

const PROVIDER = "deepseek";
const MODEL = "deepseek-flash";

function callDeepSeek(
  apiKey,
  messages
) {
  return new Promise(
    (resolve, reject) => {
      const requestBody =
        JSON.stringify({
          model: MODEL,

          messages: messages,

          response_format: {
            type: "json_object"
          },

          max_tokens: 1000,

          thinking: {
            type: "disabled"
          }
        });

      const request =
        https.request(
          {
            hostname:
              "api.deepseek.com",

            path:
              "/chat/completions",

            method: "POST",

            timeout: 15000,

            headers: {
              "Content-Type":
                "application/json",

              "Authorization":
                `Bearer ${apiKey}`,

              "Content-Length":
                Buffer.byteLength(
                  requestBody
                )
            }
          },

          response => {
            let body = "";

            response.setEncoding(
              "utf8"
            );

            response.on(
              "data",
              chunk => {
                body += chunk;

                if (
                  body.length >
                  120000
                ) {
                  request.destroy(
                    new Error(
                      "MODEL_RESPONSE_TOO_LARGE"
                    )
                  );
                }
              }
            );

            response.on(
              "end",
              () => {
                if (
                  response.statusCode <
                    200 ||
                  response.statusCode >=
                    300
                ) {
                  const error =
                    new Error(
                      "MODEL_HTTP_ERROR"
                    );

                  error.statusCode =
                    response.statusCode;

                  reject(error);
                  return;
                }

                try {
                  resolve(
                    JSON.parse(body)
                  );
                } catch (error) {
                  reject(
                    new Error(
                      "INVALID_API_RESPONSE"
                    )
                  );
                }
              }
            );
          }
        );

      request.on(
        "timeout",
        () => {
          request.destroy(
            new Error(
              "MODEL_TIMEOUT"
            )
          );
        }
      );

      request.on(
        "error",
        error => {
          reject(error);
        }
      );

      request.write(
        requestBody
      );

      request.end();
    }
  );
}

async function generate(
  options
) {
  const apiKey =
    options &&
    options.apiKey;

  const messages =
    options &&
    options.messages;

  if (
    typeof apiKey !== "string" ||
    !apiKey
  ) {
    throw new Error(
      "MISSING_PROVIDER_API_KEY"
    );
  }

  if (
    !Array.isArray(messages) ||
    messages.length === 0
  ) {
    throw new Error(
      "INVALID_PROVIDER_MESSAGES"
    );
  }

  const apiResponse =
    await callDeepSeek(
      apiKey,
      messages
    );

  const content =
    apiResponse &&
    apiResponse.choices &&
    apiResponse.choices[0] &&
    apiResponse.choices[0]
      .message &&
    apiResponse.choices[0]
      .message.content;

  if (
    typeof content !== "string" ||
    !content.trim()
  ) {
    throw new Error(
      "EMPTY_MODEL_CONTENT"
    );
  }

  return {
    provider: PROVIDER,
    model: MODEL,

    content: content,

    usage:
      apiResponse.usage
        ? {
            promptTokens:
              apiResponse.usage
                .prompt_tokens ||
              0,

            completionTokens:
              apiResponse.usage
                .completion_tokens ||
              0,

            totalTokens:
              apiResponse.usage
                .total_tokens ||
              0
          }
        : null
  };
}

module.exports = {
  generate
};
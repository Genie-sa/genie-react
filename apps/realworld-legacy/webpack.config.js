'use strict'

const path = require('node:path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const { DefinePlugin } = require('webpack')
const { resolveDevPorts } = require('./dev-ports')
const { createMockApi } = require('./mock-server')

const DEFAULT_LATENCY_MS = 60

const packageDir = (name) => path.dirname(require.resolve(`${name}/package.json`))

function numberFromEnv(name, fallback) {
  const value = process.env[name]
  if (value === undefined || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0)
    throw new Error(`${name} must be a non-negative integer`)
  return parsed
}

module.exports = (_env, argv) => {
  const isDevelopment = argv.mode !== 'production'
  const sourceDir = path.resolve(__dirname, process.env.APP_SOURCE_DIR ?? 'src')
  const { port, hubPort } = resolveDevPorts(isDevelopment ? process.env : {})
  const entry = path.join(sourceDir, 'index.tsx')

  return {
    mode: isDevelopment ? 'development' : 'production',
    context: __dirname,
    entry: isDevelopment
      ? [
          path.join(sourceDir, 'devtools/install-hook.ts'),
          path.join(sourceDir, 'devtools/connect-genie.ts'),
          entry,
        ]
      : entry,
    devtool: isDevelopment ? 'eval-cheap-module-source-map' : 'source-map',
    output: {
      path: path.resolve(__dirname, 'dist'),
      publicPath: '/',
      filename: isDevelopment ? 'static/js/[name].js' : 'static/js/[name].[contenthash:8].js',
      chunkFilename: isDevelopment
        ? 'static/js/[name].chunk.js'
        : 'static/js/[name].[contenthash:8].chunk.js',
      clean: true,
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      alias: {
        react: packageDir('react'),
        'react-dom': packageDir('react-dom'),
      },
    },
    module: {
      rules: [
        {
          test: /\.[jt]sx?$/,
          include: sourceDir,
          use: {
            loader: 'babel-loader',
            options: {
              configFile: path.resolve(__dirname, 'babel.config.json'),
              envName: isDevelopment ? 'development' : 'production',
            },
          },
        },
        {
          test: /\.module\.css$/,
          use: [
            'style-loader',
            {
              loader: 'css-loader',
              options: {
                modules: {
                  namedExport: false,
                  exportLocalsConvention: 'as-is',
                  localIdentName: isDevelopment ? '[name]__[local]' : '[hash:base64:6]',
                },
              },
            },
          ],
        },
        {
          test: /\.css$/,
          exclude: /\.module\.css$/,
          use: ['style-loader', 'css-loader'],
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({ template: path.resolve(__dirname, 'public/index.html') }),
      new DefinePlugin({
        'process.env.GENIE_HUB_URL': JSON.stringify(`ws://127.0.0.1:${hubPort}/__genie/ws`),
      }),
    ],
    performance: { hints: false },
    devServer: {
      host: '127.0.0.1',
      port,
      hot: false,
      historyApiFallback: true,
      client: { overlay: { errors: true, warnings: false, runtimeErrors: false } },
      setupMiddlewares: (middlewares) => {
        middlewares.unshift({
          name: 'mock-api',
          middleware: createMockApi({
            latencyMs: numberFromEnv('MOCK_LATENCY_MS', DEFAULT_LATENCY_MS),
          }),
        })
        return middlewares
      },
    },
  }
}

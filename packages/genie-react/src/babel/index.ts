import type * as Babel from '@babel/core'

/** The plugin API members read here; Babel 7 and 8 both provide them, unlike their differently named `ConfigAPI`/`PluginObj` types. */
interface GenieBabelApi {
  assertVersion(range: string): void
  env(envName: string): boolean
  caller(read: (caller: { name: string } | undefined) => boolean): boolean
  types: typeof Babel.types
}

interface GenieBabelPlugin {
  name: string
  visitor: { Program?(program: Babel.NodePath<Babel.types.Program>): void }
}

/** Supply lexical names that anonymous React.memo arguments do not retain at runtime. */
export default function genieComponentNames(api: GenieBabelApi): GenieBabelPlugin {
  api.assertVersion('^7.0.0 || ^8.0.0')
  const development =
    api.env('development') &&
    api.caller((caller) => !caller || !('isDev' in caller) || caller.isDev !== false)
  if (!development) return { name: 'genie-component-names', visitor: {} }
  const t = api.types

  return {
    name: 'genie-component-names',
    visitor: {
      Program(program) {
        // Resolve original imports before Metro's preset rewrites modules and refresh arguments.
        program.traverse({
          VariableDeclarator(path) {
            const { id, init } = path.node
            if (!t.isIdentifier(id) || !t.isCallExpression(init)) return
            const argument = init.arguments[0]
            if (
              !t.isArrowFunctionExpression(argument) &&
              !t.isFunctionExpression(argument, { id: null })
            )
              return
            const callee = path.get('init').get('callee') as Babel.NodePath
            if (!isReactMemo(callee)) return

            const declaration = path.parentPath
            if (!declaration.isVariableDeclaration()) return
            const statement = declaration.parentPath.isExportNamedDeclaration()
              ? declaration.parentPath
              : declaration
            // A for initializer or unbraced conditional declaration has no safe sibling insertion site.
            if (!statement.inList) return
            statement.insertAfter(
              t.expressionStatement(
                t.assignmentExpression(
                  '??=',
                  t.memberExpression(t.identifier(id.name), t.identifier('displayName')),
                  t.stringLiteral(id.name),
                ),
              ),
            )
          },
        })
      },
    },
  }
}

function isReactMemo(callee: Babel.NodePath): boolean {
  let local: string
  let namespace = false
  if (callee.isIdentifier()) {
    local = callee.node.name
  } else if (
    callee.isMemberExpression({ computed: false }) &&
    callee.get('object').isIdentifier() &&
    callee.get('property').isIdentifier({ name: 'memo' })
  ) {
    local = (callee.node.object as Babel.types.Identifier).name
    namespace = true
  } else return false

  const binding = callee.scope.getBinding(local)
  if (!binding?.constant || !binding.path.parentPath?.isImportDeclaration()) return false
  if (binding.path.parentPath.node.source.value !== 'react') return false
  if (namespace)
    return binding.path.isImportDefaultSpecifier() || binding.path.isImportNamespaceSpecifier()
  if (!binding.path.isImportSpecifier()) return false
  const imported = binding.path.node.imported
  return imported.type === 'Identifier' ? imported.name === 'memo' : imported.value === 'memo'
}

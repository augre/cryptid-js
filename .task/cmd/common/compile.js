const path = require('path');

const { run, walkDirectory } = require('./util');


const extraExportedRuntimeMethods = [
    'ccall', 'cwrap', 'stringToUTF8', 'UTF8ToString', 'writeAsciiToMemory',
    'writeArrayToMemory', 'lengthBytesUTF8'
].map(f => `"${f}"`).join(',');

const exportedFunctions = [
    '_malloc', '_free'
].map(f => `"${f}"`).join(',');

function compileLibrary({ klawSync, paths, spawnSync }, extraArguments = []) {
    const sources = discoverSources({ klawSync, paths });

    const opts = [
        ...sources.cryptidSourceFiles,
        ...sources.thirdPartySourceFiles,
        ...sources.interopSourceFiles,
        ...sources.thirdPartyLibraries,
        `-I${paths.dependencies.native.cryptid.includeDir}`,
        `-I${paths.dependencies.native.thirdParty.includeDir}`,
        `-I${paths.interop.includeDir}`,
        '-std=c99',
        '-Wall',
        '-Wextra',
        '-Werror',
        '--post-js', path.join(paths.wasm.root, 'post.js'),
        '-s', 'WASM=1',
        '-s', 'ALLOW_MEMORY_GROWTH=1',
        '-s', 'NO_EXIT_RUNTIME=0',
        '-s', `EXTRA_EXPORTED_RUNTIME_METHODS=[${extraExportedRuntimeMethods}]`,
        '-s', `EXPORTED_FUNCTIONS=[${exportedFunctions}]`,
        '-D__CRYPTID_EXTERN_RANDOM',
        '--js-library', path.join(paths.wasm.root, 'random.js'),
        '-o', paths.wasm.output.js
    ];

    opts.push(...extraArguments)

    compile({ spawnSync, paths }, opts);
};

function compileTestExecutableForComponent(componentName, { klawSync, fs, paths, spawnSync }, extraArguments = []) {    
    const componentSourceFile = paths.dependencies.native.test.componentSourceFile(componentName);

    const testExecutable = paths.wasm.test.output(componentName);

    if (!fs.pathExistsSync(componentSourceFile)) {
        throw new Error(`Component ${componentSourceFile} does not exist!`);
    }

    const sources = discoverSources({ klawSync, paths });

    const opts = [
        ...sources.cryptidSourceFiles,
        ...sources.thirdPartySourceFiles,
        ...sources.thirdPartyLibraries,
        componentSourceFile,
        `-I${paths.dependencies.native.cryptid.includeDir}`,
        `-I${paths.dependencies.native.thirdParty.includeDir}`,
        `-I${paths.interop.includeDir}`,
        '-std=c99',
        '-Wall',
        '-Wextra',
        '-Werror',
        '-g4',
        '-s', 'WASM=1',
        '-s', 'ASSERTIONS=1',
        '-s', 'ALLOW_MEMORY_GROWTH=1',
        '-s', `EXTRA_EXPORTED_RUNTIME_METHODS=[${extraExportedRuntimeMethods}]`,
        '-s', 'ENVIRONMENT=node',
        '-D__CRYPTID_EXTERN_RANDOM',
        '--js-library', path.join(paths.wasm.root, 'random.js'),
        '-o', testExecutable
    ];
    
    opts.push(...extraArguments)

    compile({ spawnSync, paths }, opts);

    return testExecutable;
};

function compile(dependencies, opts) {
    run(dependencies, 'emcc', opts, { cwd: dependencies.paths.root });
};

function discoverSources({ klawSync, paths }) {
    const cryptidSourceFiles = walkDirectory(klawSync, paths.dependencies.native.cryptid.sourceDir,
        paths.dependencies.native.cryptid.sourceExtension);
    const thirdPartySourceFiles = walkDirectory(klawSync, paths.dependencies.native.thirdParty.sourceDir,
        paths.dependencies.native.cryptid.sourceExtension);
    const interopSourceFiles = walkDirectory(klawSync, paths.interop.sourceDir,
        paths.interop.sourceExtension);
    const thirdPartyLibraries = [
        paths.dependencies.gmp.staticLibrary
    ];

    return {
        cryptidSourceFiles,
        thirdPartySourceFiles,
        interopSourceFiles,
        thirdPartyLibraries
    };
};

module.exports = {
    compileLibrary,
    compileTestExecutableForComponent
};
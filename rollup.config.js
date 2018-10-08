import nodeResolve from 'rollup-plugin-node-resolve';
//import commonjs from 'rollup-plugin-commonjs';
//import globals from 'rollup-plugin-node-globals';
//import builtins from 'rollup-plugin-node-builtins';
import babel from 'rollup-plugin-babel';
import pkg from './package.json';

export default [
	// browser-friendly UMD build
	{
		input: 'src/main.js',
		output: {file: pkg.browser, format: 'umd', name: 'k-forms'},
		plugins: [
            nodeResolve({
                jsnext: true
            }),
			babel({
				exclude: ['node_modules/**']
			})
		]
	},
	// CommonJS (for Node) and ES module (for bundlers) build.
	// (We could have three entries in the configuration array
	// instead of two, but it's quicker to generate multiple
	// builds from a single configuration where possible, using
	// the `targets` option which can specify `dest` and `format`)
	{
		input: 'src/main.js',
		external: ['ramda'],
		output: [
			{ file: pkg.main, format: 'cjs' },
			{ file: pkg.module, format: 'es' }
		],
		plugins: [
			babel({
				exclude: ['node_modules/**']
			})
		]
	}
];
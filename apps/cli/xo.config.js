import {fixupConfigRules} from '@eslint/compat';
import xoReact from 'eslint-config-xo-react';

export default [
	...fixupConfigRules(xoReact()),
	{
		rules: {
			'react/prop-types': 'off',
		},
	},
];

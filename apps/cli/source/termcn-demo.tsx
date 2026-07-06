import React from 'react';
import {Box, Text, render} from 'ink';
import {Spinner} from '@workspace/tui/components/ui/spinner';
import {ThemeProvider} from '@workspace/tui/components/ui/theme-provider';

function TermcnDemo() {
	return (
		<ThemeProvider>
			<Box flexDirection="column" gap={1}>
				<Text bold>termcn demo (@workspace/tui)</Text>
				<Spinner label="dots (default)" />
				<Spinner type="line" label="line" />
				<Spinner type="bouncingBar" label="bouncingBar" color="magenta" />
			</Box>
		</ThemeProvider>
	);
}

render(<TermcnDemo />);

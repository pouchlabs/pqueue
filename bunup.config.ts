import { defineConfig } from 'bunup'

export default defineConfig([
	{
	entry: 'src/index.ts',
	format: ['esm'],
	name:"index"
	
},
{
	entry: 'src/worker.ts',
	format: ['esm'],
	name:"worker",
}
])

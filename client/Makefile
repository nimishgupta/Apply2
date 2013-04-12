CLOSURELIB=../tools/closure-library
CLOSUREC=../tools/closure-compiler/compiler.jar
CLOSUREBUILDER=$(CLOSURELIB)/closure/bin/build/closurebuilder.py

debug: 
	$(CLOSUREBUILDER) \
		--root=$(CLOSURELIB)/closure \
		--root=$(CLOSURELIB)/third_party/closure \
		--root=src \
		--namespace=apply \
		--compiler_jar=$(CLOSUREC) \
		--output_mode=compiled \
		--compiler_flags="--compilation_level=SIMPLE_OPTIMIZATIONS" \
		--compiler_flags="--formatting=PRETTY_PRINT" \
		--compiler_flags="--debug" \
		--compiler_flags="--js_output_file=\"www/apply.min.js\"" \
		--compiler_flags="--warning_level=VERBOSE"


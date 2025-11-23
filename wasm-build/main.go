package main

import (
	"bytes"
	"fmt"
	"syscall/js"

	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/model"
)

func main() {
	// Register JavaScript functions
	js.Global().Set("pdfcpuCompress", js.FuncOf(compressPDF))
	js.Global().Set("pdfcpuOptimize", js.FuncOf(optimizePDF))
	js.Global().Set("pdfcpuVersion", js.FuncOf(getVersion))

	// Signal that WASM is ready
	js.Global().Call("dispatchEvent", js.Global().Get("CustomEvent").New("pdfcpu-ready"))

	// Keep the program running
	<-make(chan bool)
}

// getVersion returns the pdfcpu version
func getVersion(this js.Value, args []js.Value) interface{} {
	return js.ValueOf(map[string]interface{}{
		"version": model.VersionStr,
	})
}

// compressPDF compresses a PDF using pdfcpu optimization
func compressPDF(this js.Value, args []js.Value) interface{} {
	if len(args) < 2 {
		return createErrorResponse("Missing arguments: expected (pdfData, options)")
	}

	// Extract PDF data from Uint8Array
	pdfData := uint8ArrayToBytes(args[0])
	if pdfData == nil {
		return createErrorResponse("Invalid PDF data: expected Uint8Array")
	}

	// Parse options
	options := args[1]

	// Extract compression parameters
	preset := "balanced"
	if options.Get("preset").Type() == js.TypeString {
		preset = options.Get("preset").String()
	}

	targetDPI := 150
	if options.Get("targetDPI").Type() == js.TypeNumber {
		targetDPI = options.Get("targetDPI").Int()
	}

	jpegQuality := 65
	if options.Get("jpegQuality").Type() == js.TypeNumber {
		// Convert from 0-1 range to 0-100
		quality := options.Get("jpegQuality").Float()
		jpegQuality = int(quality * 100)
	}

	// Apply preset defaults
	switch preset {
	case "lossless":
		// For lossless, we don't downsample images
		targetDPI = 0
		jpegQuality = 100
	case "max":
		if options.Get("targetDPI").IsUndefined() {
			targetDPI = 120
		}
		if options.Get("jpegQuality").IsUndefined() {
			jpegQuality = 40
		}
	}

	// Perform compression
	result, err := compressPDFInternal(pdfData, targetDPI, jpegQuality)
	if err != nil {
		return createErrorResponse(fmt.Sprintf("Compression failed: %v", err))
	}

	// Return result as Uint8Array
	uint8Array := js.Global().Get("Uint8Array").New(len(result))
	js.CopyBytesToJS(uint8Array, result)

	return js.ValueOf(map[string]interface{}{
		"success": true,
		"data":    uint8Array,
		"originalSize": len(pdfData),
		"compressedSize": len(result),
	})
}

// optimizePDF performs lossless optimization on a PDF
func optimizePDF(this js.Value, args []js.Value) interface{} {
	if len(args) < 1 {
		return createErrorResponse("Missing arguments: expected (pdfData)")
	}

	// Extract PDF data from Uint8Array
	pdfData := uint8ArrayToBytes(args[0])
	if pdfData == nil {
		return createErrorResponse("Invalid PDF data: expected Uint8Array")
	}

	// Perform optimization
	result, err := optimizePDFInternal(pdfData)
	if err != nil {
		return createErrorResponse(fmt.Sprintf("Optimization failed: %v", err))
	}

	// Return result as Uint8Array
	uint8Array := js.Global().Get("Uint8Array").New(len(result))
	js.CopyBytesToJS(uint8Array, result)

	return js.ValueOf(map[string]interface{}{
		"success": true,
		"data":    uint8Array,
		"originalSize": len(pdfData),
		"optimizedSize": len(result),
	})
}

// compressPDFInternal performs the actual PDF compression
func compressPDFInternal(pdfData []byte, targetDPI, jpegQuality int) ([]byte, error) {
	input := bytes.NewReader(pdfData)
	output := new(bytes.Buffer)

	// Create optimization configuration
	conf := model.NewDefaultConfiguration()
	conf.ValidationMode = model.ValidationRelaxed

	// Enable optimization features
	conf.Cmd = model.OPTIMIZE
	conf.Optimize = true

	// Enable resource dictionary optimization (removes duplicate resources)
	conf.OptimizeResourceDicts = true

	// Enable duplicate content stream optimization
	conf.OptimizeDuplicateContentStreams = true

	// Perform optimization
	// Note: pdfcpu's Optimize function focuses on structure optimization
	// (removing redundant objects, compressing streams, etc.)
	// Advanced image DPI/quality control is not directly supported in the Go API
	err := api.Optimize(input, output, conf)
	if err != nil {
		return nil, fmt.Errorf("pdfcpu optimization error: %w", err)
	}

	return output.Bytes(), nil
}

// optimizePDFInternal performs lossless PDF optimization
func optimizePDFInternal(pdfData []byte) ([]byte, error) {
	input := bytes.NewReader(pdfData)
	output := new(bytes.Buffer)

	// Create optimization configuration
	conf := model.NewDefaultConfiguration()
	conf.ValidationMode = model.ValidationRelaxed

	// Perform optimization without image downsampling
	err := api.Optimize(input, output, conf)
	if err != nil {
		return nil, fmt.Errorf("pdfcpu optimization error: %w", err)
	}

	return output.Bytes(), nil
}

// Helper functions

// uint8ArrayToBytes converts a JavaScript Uint8Array to Go bytes
func uint8ArrayToBytes(value js.Value) []byte {
	if value.Type() != js.TypeObject {
		return nil
	}

	length := value.Get("length").Int()
	if length == 0 {
		return nil
	}

	data := make([]byte, length)
	js.CopyBytesToGo(data, value)
	return data
}

// createErrorResponse creates a standardized error response
func createErrorResponse(message string) js.Value {
	return js.ValueOf(map[string]interface{}{
		"success": false,
		"error":   message,
	})
}

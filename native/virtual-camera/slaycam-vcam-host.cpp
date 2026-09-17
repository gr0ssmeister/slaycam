#include <windows.h>
#include <fcntl.h>
#include <io.h>

#include <algorithm>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <vector>

using CameraHandle = void*;
using CreateCamera = CameraHandle(__cdecl*)(int, int, float);
using DeleteCamera = void(__cdecl*)(CameraHandle);
using SendFrame = void(__cdecl*)(CameraHandle, const void*);

static bool readExact(std::uint8_t* target, std::size_t size) {
    std::size_t received = 0;
    while (received < size) {
        const int chunk = _read(_fileno(stdin), target + received, static_cast<unsigned int>(std::min<std::size_t>(size - received, 1u << 20)));
        if (chunk <= 0) return false;
        received += static_cast<std::size_t>(chunk);
    }
    return true;
}

int wmain(int argc, wchar_t** argv) {
    if (argc != 5) return 2;
    const int width = _wtoi(argv[2]);
    const int height = _wtoi(argv[3]);
    const int fps = _wtoi(argv[4]);
    if (width <= 0 || height <= 0 || fps <= 0 || width % 4 || height % 4) return 3;

    const HMODULE module = LoadLibraryW(argv[1]);
    if (!module) return 4;
    const auto createCamera = reinterpret_cast<CreateCamera>(GetProcAddress(module, "scCreateCamera"));
    const auto deleteCamera = reinterpret_cast<DeleteCamera>(GetProcAddress(module, "scDeleteCamera"));
    const auto sendFrame = reinterpret_cast<SendFrame>(GetProcAddress(module, "scSendFrame"));
    if (!createCamera || !deleteCamera || !sendFrame) {
        FreeLibrary(module);
        return 5;
    }

    const CameraHandle camera = createCamera(width, height, static_cast<float>(fps));
    if (!camera) {
        FreeLibrary(module);
        return 6;
    }

    _setmode(_fileno(stdin), _O_BINARY);
    std::vector<std::uint8_t> rgba(static_cast<std::size_t>(width) * height * 4);
    std::vector<std::uint8_t> bgr(static_cast<std::size_t>(width) * height * 3);
    std::puts("READY");
    std::fflush(stdout);

    const std::size_t pixels = static_cast<std::size_t>(width) * height;
    while (readExact(rgba.data(), rgba.size())) {
        for (std::size_t pixel = 0; pixel < pixels; ++pixel) {
            const std::size_t source = pixel * 4;
            const std::size_t target = pixel * 3;
            bgr[target] = rgba[source + 2];
            bgr[target + 1] = rgba[source + 1];
            bgr[target + 2] = rgba[source];
        }
        sendFrame(camera, bgr.data());
    }

    deleteCamera(camera);
    FreeLibrary(module);
    return 0;
}

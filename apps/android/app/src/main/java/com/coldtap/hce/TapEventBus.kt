package com.coldtap.hce

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow

/**
 * In-process pub/sub between the NFC HostApduService and the on-screen
 * Activity. Used so the UI can react to an APDU dispatch (haptic + immediate
 * "Tap received" state) without waiting for the backend polling loop to notice
 * the status change.
 *
 * Scope is fine-grained — the service and the UI live in the same app process,
 * and this avoids BroadcastIntent / LocalBroadcastManager boilerplate.
 */
object TapEventBus {

    private val _events = MutableSharedFlow<TapEvent>(
        replay = 0,
        extraBufferCapacity = 8,
    )
    val events = _events.asSharedFlow()

    fun emit(event: TapEvent) {
        _events.tryEmit(event)
    }
}

sealed class TapEvent {
    /** An APDU was matched and SESSION:<id> was returned to the reader. */
    data class ApduDispatched(val sessionId: String) : TapEvent()

    /** NFC field dropped; the tap ended (successfully or not). */
    data object FieldLost : TapEvent()
}

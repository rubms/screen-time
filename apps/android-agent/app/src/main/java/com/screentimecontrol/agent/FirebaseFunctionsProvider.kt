package com.screentimecontrol.agent

import com.google.firebase.Firebase
import com.google.firebase.functions.FirebaseFunctions

/** Must match firebase/functions region (europe-west1, same as Firestore). */
object FirebaseFunctionsProvider {
    const val REGION = "europe-west1"

    fun get(): FirebaseFunctions =
        FirebaseFunctions.getInstance(Firebase.app, REGION)
}
